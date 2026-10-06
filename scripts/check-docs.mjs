import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { filesUnder } from "./files.mjs";
const files = (await filesUnder()).filter((f) => f.endsWith(".md"));
const errors = [];
for (const file of files) {
  const text = (await readFile(file, "utf8")).replace(
    /\x60\x60\x60[\s\S]*?\x60\x60\x60/g,
    "",
  );
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const href = match[1].split(/\s+"/)[0].replace(/^<|>$/g, "");
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) continue;
    const [target, fragment] = href.split("#");
    const resolved = target
      ? path.resolve(path.dirname(file), decodeURIComponent(target))
      : path.resolve(file);
    try {
      await access(resolved);
      if (fragment && resolved.endsWith(".md")) {
        const body = await readFile(resolved, "utf8");
        const ids = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) =>
          m[1]
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .trim()
            .replace(/\s/g, "-"),
        );
        if (!ids.includes(decodeURIComponent(fragment)))
          throw new Error("missing heading");
      }
    } catch {
      errors.push(file + ": broken link " + href);
    }
  }
}
if (errors.length) throw new Error(errors.join("\n"));
console.log("Markdown links passed: " + files.length + " files.");
