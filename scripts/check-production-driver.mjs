import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const npmCli =
  process.env.npm_execpath ||
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
const output = execFileSync(
  process.execPath,
  [npmCli, "ls", "mongodb", "--omit=dev", "--all", "--parseable"],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
);
const copies = [
  ...new Set(
    output
      .trim()
      .split(/\r?\n/)
      .filter((p) => path.basename(p) === "mongodb")
      .map((p) => realpathSync(p)),
  ),
];
if (copies.length !== 1)
  throw new Error(
    "Expected exactly one physical production mongodb copy; found " +
      copies.length,
  );
const rootRequire = createRequire(path.join(root, "package.json"));
const NativeClient = rootRequire("mongodb").MongoClient;
const entry = realpathSync(rootRequire.resolve("mongodb"));
for (const name of ["mongoose", "better-auth", "@better-auth/mongo-adapter"]) {
  const fromPackage = createRequire(rootRequire.resolve(name));
  if (
    realpathSync(fromPackage.resolve("mongodb")) !== entry ||
    fromPackage("mongodb").MongoClient !== NativeClient
  )
    throw new Error(name + " resolves a different MongoDB driver");
}
if (rootRequire("mongoose").mongo.MongoClient !== NativeClient)
  throw new Error("Mongoose has a different MongoClient identity");
console.log(
  "Production driver check passed: one physical mongodb copy; Mongoose, Better Auth and adapter share its MongoClient.",
);
