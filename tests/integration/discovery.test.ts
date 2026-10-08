import { mkdir, writeFile } from "node:fs/promises";
import { type CommandStartedEvent, MongoClient } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "mongodb";
import {
  createTestDatabaseContext,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import { discoveryFixture } from "../fixtures/discovery";
import { discoverCatalog } from "../../src/modules/catalog/discovery/service";
import {
  catalogPipeline,
  readCatalogMetadata,
} from "../../src/modules/catalog/discovery/repository";
import { normalizeCatalogQuery } from "../../src/modules/catalog/discovery/query";
import { applyIndexes } from "../../src/server/db/indexes";
import { catalogIndexes } from "../../src/modules/catalog/indexes";
import type { CatalogScope } from "../../src/modules/catalog/discovery/contracts";

describe("bounded Atlas catalog discovery", () => {
  let context: TestDatabaseContext, db: Db;
  let client: MongoClient;
  const fixture = discoveryFixture();
  const query = (params = "", scope: CatalogScope = { kind: "all" }) =>
    discoverCatalog(scope, new URLSearchParams(params), db);
  beforeAll(async () => {
    context = await createTestDatabaseContext("discovery");
    for (const collection of [
      "products",
      "variants",
      "brands",
      "categories",
      "attributes",
      "mediaAssets",
      "taxPolicies",
    ])
      await context.createCollection(collection);
    const handle = await context.createOwner().get();
    client = new MongoClient(process.env.MONGODB_URI!, {
      monitorCommands: true,
      timeoutMS: 2000,
    });
    await client.connect();
    db = client.db(handle.db.databaseName);
    await db.collection("brands").insertMany(fixture.brands);
    await db.collection("categories").insertMany(fixture.categories);
    await db.collection("attributes").insertMany(fixture.attributes);
    await db
      .collection("products")
      .insertMany(fixture.products, { timeoutMS: 10000 });
    for (let i = 0; i < fixture.variants.length; i += 100)
      await db
        .collection("variants")
        .insertMany(fixture.variants.slice(i, i + 100), { timeoutMS: 10000 });
    // Only indexes applicable to these fixtures; SKU/key/query joins are exercised.
    await applyIndexes(
      db,
      catalogIndexes.map((c) => ({
        ...c,
        indexes: c.indexes.filter(
          (i) => i.name !== "variants_combination_unique",
        ),
      })),
      { dryRun: false },
    );
  });
  afterAll(async () => {
    try {
      await client?.close();
    } finally {
      await context?.teardown();
    }
  });

  it("matches conditions on one variant, keeps own-facet alternatives and inclusive price boundaries", async () => {
    const miss = await query("f.colour=" + fixture.blue + "&max=200");
    expect(miss.total).toBe(0);
    expect(miss.price).toMatchObject({ min: 23600, max: 23600 });
    expect(miss.facets.find((f) => f.key === "f.colour")?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: fixture.blue,
          count: 0,
          selected: true,
        }),
        expect.objectContaining({ value: fixture.red, count: 248 }),
      ]),
    );
    const exact = await query("f.colour=" + fixture.blue + "&min=236&max=236");
    expect(exact.total).toBe(248);
    expect(exact.items[0]).toMatchObject({
      pricePaise: 23600,
      mrpPaise: 29500,
      variantKey: "blue-16",
      available: false,
    });
    expect(
      (await query("f.colour=" + fixture.blue + "&f.memory=" + fixture.small))
        .total,
    ).toBe(0);
    expect(
      (await query("f.colour=" + fixture.blue + "&availability=in-stock"))
        .total,
    ).toBe(0);
    expect((await query("f.weight.min=10&f.weight.max=20")).total).toBe(11);
  });

  it("deduplicates categories, bounds pages and excludes private fields and unpublished products from counts", async () => {
    const page = await query("", { kind: "category", slug: "parent" });
    expect(page.total).toBe(248);
    expect(page.items).toHaveLength(12);
    expect(page.pages).toBe(21);
    expect(page.facets.find((f) => f.key === "category")?.values).toEqual([
      expect.objectContaining({ value: "child", count: 248 }),
    ]);
    expect((await query("page=21")).items).toHaveLength(8);
    await expect(query("page=22")).rejects.toMatchObject({
      code: "PAGE_NOT_FOUND",
    });
    expect((await query("page=-1")).page).toBe(1);
    const json = JSON.stringify(page);
    for (const secret of [
      "PRIVATE-NOTE",
      "costPaise",
      "onHand",
      "reserved",
      "normalizedSku",
    ])
      expect(json).not.toContain(secret);
    expect((await query("q=SKU-0-0")).total).toBe(0);
    expect((await query("q=SKU-1-0")).total).toBe(0);
  });

  it("uses deterministic matching cards, SKU relevance, sort ties and scoped brand filters", async () => {
    const result = await query("q=SKU-23-1");
    expect(result.items[0].slug).toBe("fixture-23");
    expect(result.items[0].variantKey).toBe("blue-16");
    const first = await query("sort=price-desc&f.colour=" + fixture.red);
    expect(first.items[0].pricePaise).toBe(10000);
    const second = await query(
      "sort=price-desc&f.colour=" + fixture.red + "&page=2",
    );
    expect(
      new Set([...first.items, ...second.items].map((p) => p.id)).size,
    ).toBe(24);
    const scoped = await query("category=child", {
      kind: "brand",
      slug: "brand-0",
    });
    expect(scoped.total).toBe(124);
    expect(scoped.facets.some((f) => f.key === "brand")).toBe(false);
    expect((await query("q=SKU-23-1&f.colour=" + fixture.red)).total).toBe(0);
  });

  it("records realistic cold-request timings and explain evidence at 250 products / 750 variants", async () => {
    const meta = await readCatalogMetadata(db);
    const cases: [string, CatalogScope][] = [
      ["", { kind: "all" }],
      ["", { kind: "category", slug: "parent" }],
      ["sort=price-desc", { kind: "brand", slug: "brand-0" }],
      [
        "f.colour=" +
          fixture.blue +
          "&f.memory=" +
          fixture.large +
          "&min=200&max=250",
        { kind: "all" },
      ],
      ["q=SKU-23-1", { kind: "search" }],
      ["page=20&sort=price-asc", { kind: "all" }],
    ];
    const evidence: Record<string, unknown>[] = [];
    for (const [params, scope] of cases) {
      const samples: number[] = [];
      const operations: string[][] = [];

      for (let run = 0; run < 5; run++) {
        const commands: string[] = [];
        const observe = (event: CommandStartedEvent) => {
          if (["find", "aggregate", "getMore"].includes(event.commandName))
            commands.push(event.commandName);
        };
        client.on("commandStarted", observe);
        const start = performance.now();
        try {
          await query(params, scope);
        } finally {
          client.off("commandStarted", observe);
        }
        samples.push(performance.now() - start);
        operations.push(commands);
        expect(commands.filter((c) => c === "find")).toHaveLength(3);
        expect(commands.filter((c) => c === "aggregate")).toHaveLength(1);
        expect(commands).toHaveLength(4);
      }
      const plan = await db
        .collection("products")
        .aggregate(
          catalogPipeline(
            normalizeCatalogQuery(scope, new URLSearchParams(params), meta),
            meta,
          ),
        )
        .explain("executionStats");
      const cursor = plan.stages?.find(
        (s: Record<string, unknown>) => s.$cursor,
      )?.$cursor;
      const stats = cursor?.executionStats ?? plan.executionStats;
      evidence.push({
        operations,
        case: scope.kind + ":" + params,
        samplesMs: samples.map((n) => Math.round(n)),
        p95Ms: Math.round(samples.sort((a, b) => a - b)[4]),
        docsExamined: stats?.totalDocsExamined,
        keysExamined: stats?.totalKeysExamined,
        plan:
          cursor?.queryPlanner?.winningPlan ?? plan.queryPlanner?.winningPlan,
        lookup: plan.stages
          ?.filter((s: Record<string, unknown>) => s.$lookup)
          .map((s: Record<string, unknown>) => ({
            indexesUsed: s.indexesUsed,
            totalDocsExamined: s.totalDocsExamined,
            collectionScans: s.collectionScans,
          })),
      });
    }

    await mkdir(".validation", { recursive: true });
    await writeFile(
      ".validation/catalog-discovery-performance.json",
      JSON.stringify(
        { products: 250, variants: 750, samplesPerCase: 5, evidence },
        null,
        2,
      ),
    );
  }, 90000);
});
