import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDatabase } from "../../server/db/connection";

/** Opportunistic bounded retry; catalog TTL remains a fallback until the scheduler is deployed. */
export async function drainCatalogInvalidations() {
  const jobs = (await getDatabase()).db.collection("jobs");
  for (let count = 0; count < 10; count++) {
    const now = new Date();
    const leaseToken = randomUUID();
    const job = await jobs.findOneAndUpdate(
      {
        kind: "INVALIDATE_PUBLIC_CACHE",
        businessKey: /^(product|attribute):/,
        $or: [
          { state: { $in: ["PENDING", "RETRY"] }, dueAt: { $lte: now } },
          { state: "RUNNING", leaseUntil: { $lte: now } },
        ],
      },
      {
        $set: {
          state: "RUNNING",
          leaseToken,
          leaseUntil: new Date(Date.now() + 60000),
          updatedAt: now,
        },
        $inc: { attempts: 1 },
      },
      { sort: { dueAt: 1, _id: 1 }, returnDocument: "after" },
    );
    if (!job) break;
    try {
      for (const tag of job.payload.tags as string[])
        revalidateTag(tag, { expire: 0 });
      for (const path of (job.payload.paths ?? []) as string[])
        revalidatePath(path);
      await jobs.updateOne(
        { _id: job._id, leaseToken, state: "RUNNING" },
        {
          $set: {
            state: "SUCCEEDED",
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        },
      );
    } catch {
      await jobs.updateOne(
        { _id: job._id, leaseToken, state: "RUNNING" },
        {
          $set: {
            state: job.attempts >= 10 ? "DEAD" : "RETRY",
            dueAt: new Date(Date.now() + 60000),
            lastErrorCode: "CACHE_INVALIDATION_FAILED",
            updatedAt: new Date(),
          },
        },
      );
    }
  }
}
