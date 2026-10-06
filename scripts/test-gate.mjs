import { startVitest } from "vitest/node";

const targetSuite = process.argv[2] ?? "all";

async function runSuite(suiteName, configFile) {
  console.info(
    `\n=== Running test suite [${suiteName}] with config [${configFile}] ===`,
  );
  const vitest = await startVitest("test", [], {
    run: true,
    config: configFile,
  });

  const files = vitest.state.getFiles();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const violations = [];

  function inspectTasks(tasks, trail = []) {
    for (const t of tasks) {
      const taskTrail = [...trail, t.name].filter(Boolean).join(" > ");
      if (t.mode === "skip" || t.mode === "todo") {
        violations.push(`Task mode '${t.mode}' forbidden: ${taskTrail}`);
      }
      if (t.type === "test") {
        totalTests++;
        const state = t.result?.state;
        if (state === "pass") {
          passedTests++;
        } else if (state === "fail") {
          failedTests++;
        } else if (
          state === "skip" ||
          state === "todo" ||
          state === "pending"
        ) {
          violations.push(
            `Test result state '${state}' forbidden: ${taskTrail}`,
          );
        } else {
          violations.push(`Unrecognized test state '${state}': ${taskTrail}`);
        }
      } else if (t.tasks) {
        inspectTasks(t.tasks, [...trail, t.name]);
      }
    }
  }

  for (const f of files) {
    inspectTasks(f.tasks, [f.name]);
  }

  const unhandledErrors = vitest.state.getUnhandledErrors();
  const errorCount =
    vitest.state.getCountOfFailedTests() + unhandledErrors.length;

  await vitest.close();

  if (suiteName === "integration" && totalTests === 0) {
    violations.push(
      "Zero integration tests executed! Expected at least one real integration test.",
    );
  } else if (totalTests === 0) {
    violations.push(`Zero tests executed in suite [${suiteName}]!`);
  }

  console.info(
    `Summary for [${suiteName}]: total=${totalTests}, passed=${passedTests}, failed=${failedTests}, unhandledErrors=${unhandledErrors.length}`,
  );

  if (violations.length > 0) {
    console.error(
      `\n[TEST GATE ERROR] Forbidden test modes/states or empty suite detected in [${suiteName}]:`,
    );
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    return false;
  }

  if (failedTests > 0 || errorCount > 0) {
    console.error(
      `\n[TEST GATE ERROR] Test suite [${suiteName}] had test failures.`,
    );
    return false;
  }

  return true;
}

async function main() {
  let ok = true;
  if (targetSuite === "unit" || targetSuite === "all") {
    const res = await runSuite("unit", "vitest.config.mts");
    if (!res) ok = false;
  }
  if ((targetSuite === "integration" || targetSuite === "all") && ok) {
    const res = await runSuite("integration", "vitest.integration.config.mts");
    if (!res) ok = false;
  } else if (
    targetSuite !== "unit" &&
    targetSuite !== "integration" &&
    targetSuite !== "all"
  ) {
    const res = await runSuite("custom", targetSuite);
    if (!res) ok = false;
  }

  if (!ok) {
    process.exit(1);
  }
  console.info(
    "\n[TEST GATE] All suites passed gate criteria (no skips, no todos, no empty suites, zero failures).",
  );
}

main().catch((err) => {
  console.error("Test gate unexpected crash:", err);
  process.exit(1);
});
