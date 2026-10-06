import "server-only";
import { getDatabase, type DatabaseHandle } from "./connection.ts";
export function liveness() {
  return { status: "ok" as const };
}
export async function readiness(
  get: () => Promise<DatabaseHandle> = getDatabase,
): Promise<{ status: "ok" | "degraded" }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const handle = await get();
        await handle.db.command({ ping: 1 }, { timeoutMS: 1500 });
        return { status: "ok" as const };
      })(),
      new Promise<{ status: "degraded" }>((resolve) => {
        timer = setTimeout(() => resolve({ status: "degraded" }), 2000);
      }),
    ]);
  } catch {
    return { status: "degraded" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
