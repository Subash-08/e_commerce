export async function register() {
 if (process.env.NEXT_RUNTIME === "nodejs" && process.env.APP_RUNTIME === "long-running") {
  const { registerDatabaseShutdown } = await import("./server/db/shutdown");
  registerDatabaseShutdown();
 }
}
