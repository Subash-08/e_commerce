import "./load-environment.mjs";
import { spawn } from "node:child_process";
if (process.env.APP_ENV && process.env.APP_ENV !== "development") {
  console.error("DEVELOPMENT_ENVIRONMENT_REQUIRED");
  process.exit(1);
}
process.env.APP_ENV = "development";
process.env.NODE_ENV = "development";
process.env.APP_URL = "http://127.0.0.1:3300";
process.env.BETTER_AUTH_URL = process.env.APP_URL;
// Explicit development mailbox default; configured delivery providers retain precedence.
process.env.EMAIL_PROVIDER ||= "development";
process.env.EMAIL_FROM ||= "accounts@example.test";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3300",
  ],
  { stdio: "inherit", env: process.env },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
