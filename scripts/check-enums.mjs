import { readFile } from "node:fs/promises";
import { filesUnder } from "./files.mjs";
const registry = "docs/commerce/STATE-MACHINES.md";
const canonical = await readFile(registry, "utf8");
const domains = [...canonical.matchAll(/^\| (\w+) \| ([A-Z_][^|]*) \|$/gm)].map(
  (m) => m[1],
);
if (domains.length < 20 || new Set(domains).size !== domains.length)
  throw new Error("Invalid canonical enum registry");
const errors = [];
for (const file of await filesUnder()) {
  if (file === registry || !/\.(md|[cm]?[jt]sx?)$/.test(file)) continue;
  const text = await readFile(file, "utf8");
  for (const name of domains) {
    const patterns = [
      new RegExp("\\b(?:enum|type)\\s+" + name + "\\b\\s*(?:=|\\{)"),
      new RegExp("\\b(?:const|let)\\s+" + name + "(?:Values|Enum|s)?\\s*="),
      new RegExp("^\\|\\s*" + name + "\\s*\\|[^\\n]*\\b[A-Z][A-Z_]+\\b", "m"),
      new RegExp(
        "^\\s*(?:[-*]\\s*)?" +
          name +
          "\\s*[:=]\\s*[A-Z][A-Z_]+(?:\\s*[,|/]\\s*[A-Z][A-Z_]+)+",
        "m",
      ),
    ];
    if (patterns.some((p) => p.test(text)))
      errors.push(file + ": competing definition of " + name);
  }
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  "Canonical enum definitions passed: " +
    domains.length +
    " domains. References remain allowed.",
);
