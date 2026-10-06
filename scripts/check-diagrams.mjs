import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { filesUnder } from "./files.mjs";
await mkdir(".validation/diagrams", { recursive: true });
let count = 0;
for (const file of (await filesUnder()).filter((f) => f.endsWith(".md"))) {
  const body = await readFile(file, "utf8");
  for (const match of body.matchAll(
    /\x60\x60\x60mermaid\r?\n([\s\S]*?)\x60\x60\x60/g,
  )) {
    const input = ".validation/diagrams/" + ++count + ".mmd";
    const output = input + ".svg";
    await writeFile(input, match[1]);
    const run = spawnSync(
      process.execPath,
      [
        "node_modules/@mermaid-js/mermaid-cli/src/cli.js",
        "-i",
        input,
        "-o",
        output,
      ],
      { encoding: "utf8" },
    );
    if (run.status !== 0)
      throw new Error(
        file + ": diagram " + count + "\n" + run.stderr + run.stdout,
      );
    if (!(await readFile(output, "utf8")).includes("<svg"))
      throw new Error("Missing rendered SVG");
  }
}
if (count !== 11) throw new Error("Expected eleven diagrams; found " + count);
console.log("Rendered all " + count + " Mermaid diagrams to SVG.");
