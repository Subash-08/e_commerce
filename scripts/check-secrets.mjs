import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
const files = execFileSync(
  "git",
  [
    "-c",
    "safe.directory=" + process.cwd().replaceAll("\\", "/"),
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const problems = [];
const rules = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  [
    "provider token",
    /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|sk_live_[A-Za-z0-9]{16,}|rzp_live_[A-Za-z0-9]{12,})\b/,
  ],
  [
    "credential URL",
    /(?:mongodb(?:\+srv)?|postgres(?:ql)?):\/\/[^\s/:]+:[^\s/@]+@/i,
  ],
  [
    "secret assignment",
    /(?:secret|password|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9+/=_-]{20,}["']/i,
  ],
];
for (const file of files) {
  const base = file.split("/").at(-1);
  if (base.startsWith(".env") && base !== ".env.example") {
    problems.push(file + ": prohibited environment file (not read)");
    continue;
  }
  let bytes;
  try {
    bytes = await readFile(file);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      continue;
    throw error;
  }
  if (bytes.includes(0)) continue; // Skip binary files; inspect every text extension.
  const text = bytes.toString("utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const [name, rule] of rules)
      if (rule.test(lines[i]))
        problems.push(file + ":" + (i + 1) + ": " + name);
    if (
      base === ".env.example" &&
      /^NEXT_PUBLIC_.*(?:SECRET|KEY|TOKEN|PASSWORD|PRIVATE|URI)\s*=/i.test(
        lines[i],
      )
    )
      problems.push(file + ":" + (i + 1) + ": public secret variable");
    if (
      base === ".env.example" &&
      /^(?:[A-Z_]*(?:SECRET|PASSWORD|API_KEY|TOKEN|MONGODB_URI))\s*=\s*\S/.test(
        lines[i],
      )
    )
      problems.push(file + ":" + (i + 1) + ": populated secret example");
  }
}
if (problems.length) throw new Error(problems.join("\n"));
console.log(
  "Secret-pattern check passed for " +
    files.length +
    " source paths; heuristic only, values never reported.",
);
