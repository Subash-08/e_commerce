import "./load-environment.mjs";
import { getDatabase, closeDatabase } from "../src/server/db/connection.ts";
import { bootstrapAdministrator } from "../src/modules/identity/bootstrap.ts";
const args = process.argv.slice(2);
try {
  if (!args.includes("--approve")) throw new Error("APPROVAL_FLAG_REQUIRED");
  if (args.includes("--local") || args.includes("--verify"))
    throw new Error("LOCAL_TARGET_REFUSED");
  if (process.env.APP_ENV === "production" && !args.includes("--production"))
    throw new Error("PRODUCTION_FLAG_REQUIRED");
  const index = args.indexOf("--user-id");
  if (index < 0 || !args[index + 1]) throw new Error("USER_ID_REQUIRED");
  await bootstrapAdministrator(await getDatabase(), args[index + 1]);
  console.info(
    "Administrator created. Sign out and sign in again to use the new access.",
  );
} catch (error) {
  const safe =
    error instanceof Error &&
    [
      "APPROVAL_FLAG_REQUIRED",
      "LOCAL_TARGET_REFUSED",
      "PRODUCTION_FLAG_REQUIRED",
      "USER_ID_REQUIRED",
      "ADMIN_ALREADY_EXISTS",
      "ACTIVE_REGISTERED_USER_REQUIRED",
    ].includes(error.message)
      ? error.message
      : "BOOTSTRAP_FAILED";
  console.error(safe);
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
