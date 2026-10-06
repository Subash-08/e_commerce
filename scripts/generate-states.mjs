import { readFile, writeFile, mkdir } from "node:fs/promises";
import { format } from "prettier";
export const generatedPath = "src/shared/domain/states.generated.ts";
export async function generatedStates() {
  const source = await readFile("docs/commerce/STATE-MACHINES.md", "utf8");
  const entries = [...source.matchAll(/^\| (\w+) \| ([A-Z_][^|]*) \|$/gm)].map(
    (m) => [m[1], [...new Set(m[2].match(/\b[A-Z][A-Z_]+\b/g))]],
  );
  if (entries.length !== 23)
    throw new Error("Canonical registry changed; review the generator");
  return format(
    "// Generated from docs/commerce/STATE-MACHINES.md. Do not edit.\nexport const stateValues = " +
      JSON.stringify(Object.fromEntries(entries)) +
      " as const;\nexport type StateValue<K extends keyof typeof stateValues> = (typeof stateValues)[K][number];\n",
    { parser: "typescript" },
  );
}
export async function checkGeneratedStates() {
  if (
    (await readFile(generatedPath, "utf8")).replaceAll("\r\n", "\n") !==
    (await generatedStates())
  )
    throw new Error("Generated states are stale; run npm run generate:states");
}
if (process.argv.includes("--write")) {
  await mkdir("src/shared/domain", { recursive: true });
  await writeFile(generatedPath, await generatedStates());
}
