import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { filesUnder } from "./files.mjs";
const manifest = JSON.parse(
  await readFile("scripts/route-manifest.json", "utf8"),
);
const docs = await readFile("docs/storefront/ROUTES.md", "utf8");
const documented = new Set(
  [
    ...docs.matchAll(/(?:^|[ ,|])((?:\/[a-zA-Z0-9[\].-]+)+|\/)(?=[ ,|\r\n])/gm),
  ].map((m) => m[1]),
);
const all = [...manifest.pages, ...Object.keys(manifest.apis)];
for (const route of documented)
  if (!all.includes(route))
    throw new Error("Documented route missing from manifest: " + route);
const source = (await filesUnder("src/app"))
  .filter((f) => /\/(page|route)\.tsx?$/.test(f))
  .map(
    (f) =>
      f
        .replace(/^src\/app/, "")
        .replace(/\/\([^/]+\)/g, "")
        .replace(/\/(page|route)\.tsx?$/, "") || "/",
  );
if (source.length !== all.length || source.some((r) => !all.includes(r)))
  throw new Error("Manifest and filesystem route mismatch");
const require = createRequire(import.meta.url);
const mermaidRequire = createRequire(
  require.resolve("@mermaid-js/mermaid-cli"),
);
const { default: puppeteer } = await import(
  pathToFileURL(mermaidRequire.resolve("puppeteer")).href
);
const port = 3217;
const base = "http://127.0.0.1:" + port;
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    String(port),
    "-H",
    "127.0.0.1",
  ],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      APP_ENV: "test",
      MONGODB_URI: "",
      MONGODB_DB_NAME: "",
      EMAIL_PROVIDER: "",
      BETTER_AUTH_SECRET: "",
      RESEND_API_KEY: "",
      N8N_WEBHOOK_URL: "",
      N8N_WEBHOOK_SECRET: "",
    },
  },
);
let log = "";
child.stdout.on("data", (chunk) => {
  log += chunk;
});
child.stderr.on("data", (chunk) => {
  log += chunk;
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error("Server exited: " + log);
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Server readiness timed out");
  browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of manifest.pages) {
    const url = route.replace(/\[[^\]]+\]/g, "stage-3-example");
    const response = await page.goto(base + url, { waitUntil: "networkidle0" });
    if (response.status() !== 200)
      throw new Error(route + ": HTTP " + response.status());
    const accountForm = [
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password",
    ].includes(route);
    const guarded = route.startsWith("/admin") || route.startsWith("/account");
    if (accountForm || guarded) {
      if (guarded && new URL(page.url()).pathname !== "/login")
        throw new Error(route + ": unauthenticated access was not redirected");
      const visible = await page.$eval('[data-feature="auth"]', (element) =>
        element.checkVisibility(),
      );
      if (!visible) throw new Error(route + ": missing visible account form");
    } else {
      const visible = await page.$eval(
        "[data-placeholder]",
        (element) =>
          element.checkVisibility() &&
          element.textContent.includes("Placeholder — not implemented."),
      );
      const shell = await page.$eval(
        "body",
        (element) => element.dataset.shell,
      );
      if (!visible || shell !== "store")
        throw new Error(route + ": invalid placeholder or root layout");
    }
  }
  await page.screenshot({
    path: ".validation/admin-placeholder.png",
    fullPage: true,
  });
  await page.goto(base + "/login", { waitUntil: "networkidle0" });
  await page.screenshot({ path: ".validation/auth-login.png", fullPage: true });
  await page.goto(base, { waitUntil: "networkidle0" });
  await page.screenshot({
    path: ".validation/store-placeholder.png",
    fullPage: true,
  });
  for (const [route, methods] of Object.entries(manifest.apis)) {
    for (const method of methods) {
      const response = await fetch(
        base + route.replace(/\[[^\]]+\]/g, "stage-3-example"),
        { method },
      );
      if (response.headers.get("cache-control") !== "no-store")
        throw new Error(route + ": missing no-store cache-control header");
      const body = await response.json();
      if (route === "/api/health") {
        if (
          response.status !== 200 ||
          body.status !== "ok" ||
          Object.keys(body).length !== 1
        )
          throw new Error(route + ": expected HTTP 200 { status: 'ok' }");
      } else if (route === "/api/ready") {
        // Without configured database in check-routes, readiness returns 503 degraded
        if (
          response.status !== 503 ||
          body.status !== "degraded" ||
          Object.keys(body).length !== 1
        )
          throw new Error(
            route +
              ": expected HTTP 503 { status: 'degraded' } when unconfigured",
          );
      } else if (route === "/api/auth/[...all]") {
        if (response.status !== 404 || body.error !== "NOT_FOUND")
          throw new Error("Unknown auth operation must return 404");
      } else {
        if (response.status !== 501 || !body.placeholder)
          throw new Error(route + ": invalid API placeholder");
      }
    }
  }
  const missing = await fetch(base + "/stage-3-missing-route");
  if (missing.status !== 404) throw new Error("Unknown route must return 404");
  if (errors.length) throw new Error("Browser errors: " + errors.join("; "));
  console.log(
    "Rendered " +
      manifest.pages.length +
      " pages visibly in Chromium; checked " +
      Object.values(manifest.apis).flat().length +
      " API methods, route coverage and 404.",
  );
} finally {
  await browser?.close();
  child.kill();
}
