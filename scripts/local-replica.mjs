import { MongoMemoryReplSet } from "mongodb-memory-server";
import { spawn } from "node:child_process";
import path from "node:path";
if (
  process.env.NODE_ENV === "production" ||
  process.env.APP_ENV === "production" ||
  process.env.APP_ENV === "staging"
)
  throw new Error("Local replica launcher refuses production/staging");
const version = "8.2.6";
let replica;
let app;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if (app && app.exitCode === null) {
    const exited = new Promise((resolve) => app.once("exit", resolve));
    app.kill("SIGTERM");
    await Promise.race([
      exited,
      new Promise((resolve) => {
        const timer = setTimeout(resolve, 5000);
        timer.unref();
      }),
    ]);
    if (app.exitCode === null) app.kill("SIGKILL");
  }
  await replica?.stop();
}
process.once("SIGINT", () => {
  void close();
});
process.once("SIGTERM", () => {
  void close();
});
try {
  replica = await MongoMemoryReplSet.create({
    binary: {
      version,
      downloadDir: path.resolve(".cache/mongodb-binaries"),
      checkMD5: true,
    },
    replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" },
  });
  if (closing) {
    await replica.stop();
  } else {
    console.info(
      "Ephemeral local replica ready. Data is removed on shutdown. Starting development app; no URI is logged.",
    );
    app = spawn(
      process.execPath,
      ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          NODE_ENV: "development",
          APP_ENV: "development",
          APP_RUNTIME: "long-running",
          MONGODB_URI: replica.getUri("commerce_development"),
          MONGODB_DB_NAME: "commerce_development",
          MONGODB_MAX_POOL_SIZE: "5",
        },
      },
    );
    app.once("exit", (code) => {
      process.exitCode = code ?? 0;
      void close();
    });
    app.once("error", () => {
      process.exitCode = 1;
      void close();
    });
  }
} catch {
  console.error(
    "Local replica startup failed. Check MongoDB binary download and operating-system support; details must be reviewed without environment values.",
  );
  process.exitCode = 1;
  await close();
}
