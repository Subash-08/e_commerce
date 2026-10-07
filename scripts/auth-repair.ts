import "./load-environment.mjs";
import { getDatabase, closeDatabase } from "../src/server/db/connection.ts";
import { repairMissingProfile } from "../src/modules/identity/repair.ts";
const args = process.argv.slice(2);
try {
  if (!args.includes("--approve")) throw new Error("APPROVAL_FLAG_REQUIRED");
  if (process.env.APP_ENV === "production" && !args.includes("--production"))
    throw new Error("PRODUCTION_FLAG_REQUIRED");
  const index = args.indexOf("--user-id");
  if (index < 0 || !args[index + 1]) throw new Error("USER_ID_REQUIRED");
  const result = await repairMissingProfile(
    await getDatabase(),
    args[index + 1],
  );
  console.info(
    result.created
      ? "Missing customer profile recovered and audited."
      : "Existing profile preserved; no changes made.",
  );
} catch (error) {
  const code = error instanceof Error ? error.message : "";
  console.error(
    [
      "APPROVAL_FLAG_REQUIRED",
      "PRODUCTION_FLAG_REQUIRED",
      "USER_ID_REQUIRED",
      "INVALID_USER_ID",
      "USER_NOT_FOUND",
      "AUTH_INDEX_DRIFT",
    ].includes(code)
      ? code
      : "PROFILE_REPAIR_FAILED",
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
