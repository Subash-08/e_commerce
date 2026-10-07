import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { getDatabase } from "../../server/db/connection";

export async function drainBrandInvalidations() {
  const db = (await getDatabase()).db;
  const jobs = await db
    .collection("jobs")
    .find({
      kind: "INVALIDATE_PUBLIC_CACHE",
      businessKey: /^brand:/,
      state: { $in: ["PENDING", "RETRY"] },
      dueAt: { $lte: new Date() },
    })
    .sort({ dueAt: 1 })
    .limit(10)
    .toArray();
  for (const job of jobs) {
    try {
      for (const tag of job.payload.tags as string[])
        revalidateTag(tag, { expire: 0 });
      for (const path of job.payload.paths as string[]) revalidatePath(path);
      await db.collection("jobs").updateOne(
        { _id: job._id },
        {
          $set: { state: "SUCCEEDED", completedAt: new Date() },
          $inc: { attempts: 1 },
        },
      );
    } catch {
      await db.collection("jobs").updateOne(
        { _id: job._id },
        {
          $set: {
            state: "RETRY",
            dueAt: new Date(Date.now() + 30000),
            lastErrorCode: "CACHE_INVALIDATION_FAILED",
          },
          $inc: { attempts: 1 },
        },
      );
    }
  }
}
