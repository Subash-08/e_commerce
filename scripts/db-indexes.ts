import "./load-environment.mjs";
import { getDatabase, closeDatabase } from "../src/server/db/connection.ts";
import { approvedIndexes } from "../src/server/db/approved-indexes.ts";
import { applyIndexes, checkIndexes } from "../src/server/db/indexes.ts";
import { normalizeDatabaseError } from "../src/server/db/errors.ts";
const [command, ...flags] = process.argv.slice(2);
try {
  if (
    !["check", "apply"].includes(command) ||
    flags.some((f) => !["--dry-run", "--approve"].includes(f))
  )
    throw new Error("INVALID_COMMAND");
  if (!approvedIndexes.length) {
    console.info(
      JSON.stringify({ status: "no-approved-indexes", checkedCollections: 0 }),
    );
  } else {
    const { db } = await getDatabase();
    if (command === "check") {
      const differences = await checkIndexes(db, approvedIndexes);
      console.info(JSON.stringify({ differences }, null, 2));
      if (differences.length) process.exitCode = 1;
    } else {
      const dryRun = flags.includes("--dry-run");
      if (!dryRun && !flags.includes("--approve"))
        throw new Error("APPROVAL_FLAG_REQUIRED");
      console.info(
        JSON.stringify(
          await applyIndexes(db, approvedIndexes, { dryRun }),
          null,
          2,
        ),
      );
    }
  }
} catch (error) {
  console.error(
    JSON.stringify({
      code: normalizeDatabaseError(error, "DB_INDEX_DRIFT").code,
    }),
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
