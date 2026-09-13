const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const APP = path.resolve(__dirname, "../app");
const BASE = "https://example.github.io/zaoan-hub/";

function assertPublicFile(reference) {
  assert.ok(reference.startsWith("./"), `${reference} must be relative to the project site`);
  const url = new URL(reference, BASE);
  assert.equal(url.origin, new URL(BASE).origin);
  assert.ok(url.pathname.startsWith(new URL(BASE).pathname), `${reference} escapes the app scope`);
  const relative = url.pathname.slice(new URL(BASE).pathname.length) || "index.html";
  assert.ok(fs.statSync(path.join(APP, relative)).isFile(), `${reference} is missing`);
}

test("HTML resources work under a GitHub Pages repository subdirectory", () => {
  for (const file of ["index.html", "guide.html"]) {
    const html = fs.readFileSync(path.join(APP, file), "utf8");
    for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (reference.startsWith("#")) continue;
      assertPublicFile(reference);
    }
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.ok(!html.includes("'unsafe-inline'"), "Pages must retain the existing CSP fallback");
  }
});

test("PWA installation URLs and icons stay within the deployed app", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(APP, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.display, "standalone");
  for (const reference of [manifest.id, manifest.start_url, manifest.scope, ...manifest.icons.map(icon => icon.src)]) {
    assertPublicFile(reference);
  }
});

test("every offline-shell asset exists in the public artifact", () => {
  const source = fs.readFileSync(path.join(APP, "sw.js"), "utf8");
  const context = { URL, self: { registration: { scope: BASE }, addEventListener() {} } };
  vm.runInNewContext(`${source}\nthis.shell = APP_SHELL_PATHS; this.prefix = CACHE_PREFIX;`, context);
  for (const reference of context.shell) assertPublicFile(reference);
  assert.ok(context.prefix.includes("/zaoan-hub/"));
  assert.ok(context.shell.includes("./index.html") && context.shell.includes("./guide.html"));
  assert.ok(!context.shell.some(reference => reference.includes("server.py") || reference.includes("tests/")));
});

test("public artifact excludes unexpected file types and symbolic links", () => {
  const allowed = new Set([".html", ".css", ".js", ".svg", ".png", ".webmanifest"]);
  for (const file of fs.readdirSync(APP, { withFileTypes: true })) {
    assert.ok(file.isFile() && !file.isSymbolicLink(), `Review unexpected artifact entry: ${file.name}`);
    assert.ok(allowed.has(path.extname(file.name)), `Review unexpected public file: ${file.name}`);
  }
});
