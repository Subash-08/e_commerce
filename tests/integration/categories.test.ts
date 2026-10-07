import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanupAll,
  createTestDatabaseContext,
  stopSharedTestReplicaSet,
  type TestDatabaseContext,
} from "../fixtures/db-harness";
import type { DatabaseHandle } from "../../src/server/db/connection";
import { applyIndexes } from "../../src/server/db/indexes";
import { categoryIndexes } from "../../src/modules/categories/indexes";
import { categoryService } from "../../src/modules/categories/service";
import type { CategoryInput } from "../../src/modules/categories/validation";

describe("category management invariants", () => {
  let context: TestDatabaseContext;
  let database: DatabaseHandle;
  let service: ReturnType<typeof categoryService>;
  const actorId = "category-admin";

  beforeAll(async () => {
    context = await createTestDatabaseContext("category");
    for (const item of categoryIndexes)
      await context.createCollection(item.collection);
    for (const name of ["profiles", "products", "auditLogs", "jobs"])
      await context.createCollection(name);
    database = await context.createOwner().get();
    await applyIndexes(database.db, categoryIndexes, { dryRun: false });
    service = categoryService(database, async () => ({ authUserId: actorId }));
  });

  beforeEach(async () => {
    for (const name of context.ownedCollections)
      await database.db.collection(name).deleteMany({});
    await database.db
      .collection("profiles")
      .insertOne({ authUserId: actorId, role: "ADMIN", status: "ACTIVE" });
  });

  afterAll(async () => {
    await cleanupAll([
      () => context?.teardown(),
      () => stopSharedTestReplicaSet(),
    ]);
  });

  const input = (overrides: Partial<CategoryInput> = {}): CategoryInput => ({
    name: "Category",
    slug: "category",
    parentId: null,
    description: "",
    active: true,
    featured: false,
    archived: false,
    deactivationReason: "",
    displayOrder: 0,
    thumbnailId: null,
    bannerId: null,
    seo: {
      title: "",
      description: "",
      canonicalPath: "",
      robotsIndex: true,
      robotsFollow: true,
    },
    ...overrides,
  });

  it("persists hierarchy and serves indexed server-side filters", async () => {
    const parent = await service.save(
      new Headers(),
      input({ name: "Cameras", slug: "cameras", displayOrder: 2 }),
    );
    await service.save(
      new Headers(),
      input({
        name: "Lenses",
        slug: "lenses",
        parentId: parent.id,
        displayOrder: 1,
      }),
    );
    await service.save(
      new Headers(),
      input({
        name: "Audio",
        slug: "audio",
        active: false,
        deactivationReason: "Not launched",
      }),
    );

    const result = await service.list(new Headers(), {
      search: "len",
      status: "active",
      parentId: parent.id,
      sort: "name",
      page: 1,
    });
    expect(result.total).toBe(1);
    expect(result.rows[0]).toMatchObject({
      name: "Lenses",
      parentId: parent.id,
      active: true,
    });
    expect(result.options.map((option) => option.name)).toEqual([
      "Audio",
      "Cameras",
      "Lenses",
    ]);
  });

  it("rejects cycles, unsafe parent deactivation and stale writes", async () => {
    const parent = await service.save(
      new Headers(),
      input({ name: "Computers", slug: "computers" }),
    );
    const child = await service.save(
      new Headers(),
      input({ name: "Laptops", slug: "laptops", parentId: parent.id }),
    );

    await expect(
      service.save(
        new Headers(),
        input({
          id: parent.id,
          revision: 0,
          name: "Computers",
          slug: "computers",
          parentId: child.id,
        }),
      ),
    ).rejects.toMatchObject({ message: "CATEGORY_CYCLE" });
    await expect(
      service.save(
        new Headers(),
        input({
          id: parent.id,
          revision: 0,
          name: "Computers",
          slug: "computers",
          active: false,
          deactivationReason: "Pause",
        }),
      ),
    ).rejects.toMatchObject({ message: "CATEGORY_PARENT_UNAVAILABLE" });

    await service.save(
      new Headers(),
      input({
        id: child.id,
        revision: 0,
        name: "Laptops",
        slug: "notebooks",
        parentId: parent.id,
      }),
    );
    await expect(
      service.save(
        new Headers(),
        input({
          id: child.id,
          revision: 0,
          name: "Laptops",
          slug: "portable-computers",
          parentId: parent.id,
        }),
      ),
    ).rejects.toMatchObject({ message: "REVISION_CONFLICT" });
    expect(
      await database.db
        .collection("redirects")
        .findOne({ fromPath: "/category/laptops" }),
    ).toMatchObject({ toPath: "/category/notebooks", statusCode: 301 });
  });
});
