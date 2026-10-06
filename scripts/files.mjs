import { readdir } from "node:fs/promises";
import path from "node:path";
const skipped = new Set([
  ".git",
  "node_modules",
  ".next",
  ".tools",
  ".cache",
  ".validation",
]);
export async function filesUnder(dir = ".") {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (
      skipped.has(entry.name) ||
      (entry.name.startsWith(".env") && entry.name !== ".env.example")
    )
      continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...(await filesUnder(file)));
    else result.push(file.replaceAll("\\", "/"));
  }
  return result;
}
