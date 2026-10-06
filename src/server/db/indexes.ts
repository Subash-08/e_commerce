import "server-only";
import { BSON } from "mongodb";
import type {
  CollationOptions,
  Db,
  IndexDescription,
  IndexDescriptionInfo,
} from "mongodb";
import { DatabaseError, normalizeDatabaseError } from "./errors.ts";
import { assertOutsideTransaction } from "./transaction.ts";
export interface ApprovedIndex {
  readonly name: string;
  readonly key: Readonly<Record<string, 1 | -1>>;
  readonly unique?: boolean;
  readonly sparse?: boolean;
  readonly partialFilterExpression?: Readonly<Record<string, unknown>>;
  readonly collation?: Readonly<CollationOptions>;
  readonly expireAfterSeconds?: number;
  readonly hidden?: boolean;
}
export interface CollectionIndexes {
  readonly collection: string;
  readonly indexes: readonly ApprovedIndex[];
}
export interface IndexDifference {
  readonly collection: string;
  readonly name: string;
  readonly kind: "missing" | "unexpected" | "different";
  readonly expected?: unknown;
  readonly actual?: unknown;
}
function sorted(value: unknown): unknown {
  function order(item: unknown): unknown {
    if (Array.isArray(item)) return item.map(order);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, child]) => [key, order(child)]),
      );
    return item;
  }
  try {
    return order(BSON.EJSON.serialize(value, { relaxed: false }));
  } catch (error) {
    throw new DatabaseError("DB_CONFIG_INVALID", error);
  }
}
function collation(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const { version: _version, ...fields } = value as Record<string, unknown>;
  void _version;
  if (fields.locale === "simple") return { locale: "simple" };
  return sorted({
    caseLevel: false,
    caseFirst: "off",
    strength: 3,
    numericOrdering: false,
    alternate: "non-ignorable",
    maxVariable: "punct",
    normalization: false,
    backwards: false,
    ...fields,
  });
}
function definition(index: ApprovedIndex | IndexDescriptionInfo) {
  return {
    key: Object.entries(index.key),
    unique: index.unique ?? false,
    sparse: index.sparse ?? false,
    partialFilterExpression: sorted(index.partialFilterExpression ?? null),
    collation: collation(index.collation),
    expireAfterSeconds: index.expireAfterSeconds ?? null,
    hidden: index.hidden ?? false,
  };
}
function validateManifest(manifest: readonly CollectionIndexes[]) {
  const collections = new Set<string>();
  for (const entry of manifest) {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_]{0,100}$/.test(entry.collection) ||
      collections.has(entry.collection)
    )
      throw new DatabaseError("DB_CONFIG_INVALID");
    collections.add(entry.collection);
    const names = new Set<string>();
    for (const index of entry.indexes) {
      if (
        !index.name ||
        index.name === "_id_" ||
        names.has(index.name) ||
        !Object.keys(index.key).length ||
        Object.values(index.key).some((v) => v !== 1 && v !== -1) ||
        (index.expireAfterSeconds !== undefined &&
          (!Number.isSafeInteger(index.expireAfterSeconds) ||
            index.expireAfterSeconds < 0))
      )
        throw new DatabaseError("DB_CONFIG_INVALID");
      names.add(index.name);
    }
  }
}
export async function checkIndexes(
  db: Db,
  manifest: readonly CollectionIndexes[],
): Promise<IndexDifference[]> {
  validateManifest(manifest);
  const differences: IndexDifference[] = [];
  for (const entry of manifest) {
    let actual: IndexDescriptionInfo[];
    try {
      actual = await db.collection(entry.collection).listIndexes().toArray();
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === 26
      )
        actual = [];
      else throw normalizeDatabaseError(error);
    }
    for (const expected of entry.indexes) {
      const found = actual.find((i) => i.name === expected.name);
      if (!found)
        differences.push({
          collection: entry.collection,
          name: expected.name,
          kind: "missing",
          expected: definition(expected),
        });
      else if (
        JSON.stringify(definition(found)) !==
        JSON.stringify(definition(expected))
      )
        differences.push({
          collection: entry.collection,
          name: expected.name,
          kind: "different",
          expected: definition(expected),
          actual: definition(found),
        });
    }
    for (const found of actual)
      if (
        found.name !== "_id_" &&
        !entry.indexes.some((i) => i.name === found.name)
      )
        differences.push({
          collection: entry.collection,
          name: found.name ?? "<unnamed>",
          kind: "unexpected",
          actual: definition(found),
        });
  }
  return differences;
}
export async function applyIndexes(
  db: Db,
  manifest: readonly CollectionIndexes[],
  options: { readonly dryRun: boolean },
) {
  assertOutsideTransaction();
  const differences = await checkIndexes(db, manifest);
  if (differences.some((d) => d.kind === "different"))
    throw new DatabaseError("DB_INDEX_DRIFT");
  const missing = differences.filter((d) => d.kind === "missing");
  if (options.dryRun)
    return {
      created: [] as string[],
      planned: missing,
      unexpected: differences.filter((d) => d.kind === "unexpected"),
    };
  const created: string[] = [];
  try {
    for (const difference of missing) {
      const index = manifest
        .find((e) => e.collection === difference.collection)!
        .indexes.find((i) => i.name === difference.name)!;
      const { key, ...indexOptions } = index;
      const spec: IndexDescription = { key: { ...key }, ...indexOptions };
      await db.collection(difference.collection).createIndexes([spec]);
      created.push(difference.collection + "." + difference.name);
    }
  } catch (error) {
    throw normalizeDatabaseError(error, "DB_INDEX_DRIFT");
  }
  return {
    created,
    planned: missing,
    unexpected: differences.filter((d) => d.kind === "unexpected"),
  };
}
