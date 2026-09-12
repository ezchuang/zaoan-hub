const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE = process.env.TEST_URL || "http://127.0.0.1:8765/";
const OUTPUT = path.resolve(__dirname, "../.test-artifacts");
const STATE_KEY = "zaoan-hub-state-v1";
let browser;

before(async () => {
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(new URL(BASE).hostname), "Use a local test server only");
  assert.equal((await fetch(BASE)).status, 200, "Start python server.py first");
  await fs.mkdir(OUTPUT, { recursive: true });
  browser = await chromium.launch({
    headless: true,
    channel: process.env.BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : undefined)
  });
});
after(async () => { await browser?.close(); });

async function setup(t, options = {}) {
  const context = await browser.newContext({ serviceWorkers: "block", viewport: { width: 1280, height: 960 }, ...options });
  t.after(() => context.close());
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], "No uncaught browser errors"));
  return { context, page };
}

async function ready(page) {
  await page.waitForFunction(() => !document.getElementById("share-button").disabled);
}

async function nativeShareMock(context, outcome = "success") {
  await context.addInitScript((result) => {
    window.shareCalls = [];
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (payload) => {
      window.shareCalls.push({
        keys: Object.keys(payload),
        files: payload.files.map((file) => ({ name: file.name, size: file.size, type: file.type })),
        active: navigator.userActivation.isActive
      });
      if (result === "cancel") throw new DOMException("Cancelled", "AbortError");
      if (result === "fail") throw new DOMException("Denied", "NotAllowedError");
    } });
  }, outcome);
}

test("first visit shows a usable greeting without fake contacts; responsive layouts", async (t) => {
  const { context, page } = await setup(t);
  await nativeShareMock(context);
  await page.goto(BASE);
  await ready(page);
  assert.equal(await page.locator("#contact-count").textContent(), "0 位");
  assert.equal(await page.locator("#campaign-sender").inputValue(), "");
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ["today", "contacts", "settings"]) {
      await page.locator(`[data-view-link="${view}"]`).click();
      await page.locator(`#${view}`).waitFor({ state: "visible" });
      assert.equal(await page.locator(`#${view}`).isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${view} fits ${width}px`);
    }
    await page.locator('[data-view-link="today"]').click();
    await page.locator("#today").waitFor({ state: "visible" });
    await page.screenshot({ path: path.join(OUTPUT, `today-${width}.png`), fullPage: true, animations: "disabled" });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const shareBox = await page.locator("#share-button").boundingBox();
  assert.ok(shareBox.y + shareBox.height < 844, "Primary sharing action appears in the first mobile viewport");
  await page.evaluate(() => {
    const sheet = document.styleSheets[0];
    sheet.insertRule(":root { font-size: 36px; }", sheet.cssRules.length);
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "200% text does not overflow");
});

test("private sharing preserves user activation and sends only an image", async (t) => {
  const { context, page } = await setup(t);
  await nativeShareMock(context);
  await page.goto(BASE);
  await page.locator("#campaign-message").fill("早安\n今天也要開開心心！");
  await page.locator("#campaign-sender").fill("美惠");
  await ready(page);
  await page.locator("#share-button").click();
  const calls = await page.evaluate(() => window.shareCalls);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].keys, ["files"]);
  assert.equal(calls[0].files[0].type, "image/png");
  assert.ok(calls[0].files[0].size > 1000);
  assert.equal(calls[0].active, true);
  assert.match(await page.locator("#share-result").textContent(), /無法確認送達/);
  await page.reload();
  await ready(page);
  assert.equal(await page.locator("#campaign-sender").inputValue(), "美惠");
  assert.equal(await page.locator("#campaign-message").inputValue(), "早安\n今天也要開開心心！");
});

for (const outcome of ["cancel", "fail"]) {
  test(`sharing ${outcome} leaves a retryable draft`, async (t) => {
    const { context, page } = await setup(t);
    await nativeShareMock(context, outcome);
    await page.goto(BASE);
    await ready(page);
    await page.locator("#share-button").click();
    await ready(page);
    assert.match(await page.locator("#share-result").textContent(), outcome === "cancel" ? /已取消/ : /下載圖片/);
  });
}

test("unsupported image sharing downloads PNG; denied clipboard is not reported as copied", async (t) => {
  const { context, page } = await setup(t);
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Denied"); } } });
  });
  await page.goto(BASE);
  await ready(page);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#share-button").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "zaoan-greeting.png");
  const data = await fs.readFile(await download.path());
  assert.equal(data.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  await page.locator("#copy-button").click();
  assert.match(await page.locator("#share-result").textContent(), /無法自動複製/);
  assert.equal(await page.locator("#campaign-message").evaluate((node) => node.selectionEnd - node.selectionStart), (await page.locator("#campaign-message").inputValue()).length);
});

test("contacts and optional groups can be selected, cleared and safely deleted", async (t) => {
  const { page } = await setup(t);
  await page.goto(BASE);
  await page.locator('[data-view-link="contacts"]').click();
  await page.locator("#contact-name").fill("王阿姨");
  await page.locator('#contact-form button[type="submit"]').click();
  await page.locator("#group-name").fill("家人");
  await page.locator('#group-members-picker input').check();
  await page.locator("#contact-name").fill("陳伯伯");
  await page.locator('#contact-form button[type="submit"]').click();
  assert.equal(await page.locator('#group-members-picker input:checked').count(), 1, "Unsubmitted group members survive adding a contact");
  await page.locator('#group-form button[type="submit"]').click();
  await page.locator('[data-view-link="today"]').click();
  await page.locator(".recipient-details summary").click();
  await page.locator("#campaign-group").selectOption({ label: "家人" });
  assert.equal(await page.locator('#campaign-recipients-picker input:checked').count(), 1);
  await page.locator("#clear-selection-button").click();
  assert.equal(await page.locator('#campaign-recipients-picker input:checked').count(), 0);
  await page.locator('[data-view-link="contacts"]').click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.locator('[data-action="remove-contact"]').first().click();
  assert.equal(await page.locator('#contacts-list .list-card').count(), 2);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator('[data-action="remove-contact"]').first().click();
  assert.equal(await page.locator('#contacts-list .list-card').count(), 1);
});

test("long and multiline greetings remain bounded with an honest readability hint", async (t) => {
  const { page } = await setup(t);
  await page.goto(BASE);
  await page.locator("#campaign-message").fill("祝福".repeat(250));
  await ready(page);
  assert.match(await page.locator("#message-hint").textContent(), /縮小|省略/);
  await page.locator("#campaign-message").fill("早安\n".repeat(100));
  await ready(page);
  assert.match(await page.locator("#message-hint").textContent(), /省略/);
});

test("installation guide progress is optional and never inferred from a contact list", async (t) => {
  const { page } = await setup(t, { viewport: { width: 390, height: 844 } });
  await page.goto(new URL("guide.html", BASE).href);
  assert.equal(await page.locator("[data-guide-step]:checked").count(), 0);
  await page.locator('[data-guide-step="opened_safari"]').check();
  await page.reload();
  assert.equal(await page.locator('[data-guide-step="opened_safari"]').isChecked(), true);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(OUTPUT, "guide-mobile.png"), fullPage: true });
});

test("corrupt persisted state is not overwritten and the greeting remains usable", async (t) => {
  const { context, page } = await setup(t);
  await context.addInitScript((key) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(key, '{"contacts":[null],"groups":[],"campaign":{}}');
      sessionStorage.setItem("seeded", "yes");
    }
  }, STATE_KEY);
  await page.goto(BASE);
  await ready(page);
  assert.equal(await page.locator("#storage-warning").isVisible(), true);
  await page.locator("#campaign-message").fill("不覆蓋舊資料");
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STATE_KEY), '{"contacts":[null],"groups":[],"campaign":{}}');
});

test("blocked storage does not crash the app or incorrectly promise saved data", async (t) => {
  const { context, page } = await setup(t);
  await context.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Denied", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Denied", "SecurityError"); };
  });
  await page.goto(BASE);
  await ready(page);
  assert.equal(await page.locator("#storage-warning").isVisible(), true);
  assert.equal(await page.locator("#draft-status").textContent(), "尚未儲存");
  await page.goto(new URL("guide.html", BASE).href);
  assert.equal(await page.locator("#guide-storage-warning").isVisible(), true);
});

test("a full storage device can still export the latest in-memory draft", async (t) => {
  const { page } = await setup(t);
  await page.goto(BASE);
  await ready(page);
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); }; });
  await page.locator("#campaign-message").fill("這是最新還沒存下來的祝福");
  assert.equal(await page.locator("#storage-warning").isVisible(), true);
  await page.locator('[data-view-link="settings"]').click();
  const pending = page.waitForEvent("download");
  await page.locator("#export-state-button").click();
  const saved = JSON.parse(await fs.readFile(await (await pending).path(), "utf8"));
  assert.equal(saved.state.campaign.message, "這是最新還沒存下來的祝福");
});

test("import rejects unrelated JSON, preserves cancelled imports and round-trips an empty signature", async (t) => {
  const { page } = await setup(t);
  await page.goto(BASE);
  await ready(page);
  await page.locator("#campaign-message").fill("原本的祝福");
  await page.locator('[data-view-link="settings"]').click();
  const upload = (value) => page.locator("#import-state-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)) });
  await upload({});
  assert.match(await page.locator("#status-box").textContent(), /匯入失敗/);
  assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).campaign.message, STATE_KEY), "原本的祝福");
  const backup = await page.evaluate(() => window.ZaoanApp.getState());
  backup.campaign.message = "還原的祝福";
  backup.campaign.sender = "";
  backup.contacts.push({ id: "c1", name: "<img src=x>", channel: "line", note: "<script>alert(1)</script>" });
  page.once("dialog", (dialog) => dialog.dismiss());
  await upload(backup);
  assert.equal(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).campaign.message, STATE_KEY), "原本的祝福");
  page.once("dialog", (dialog) => dialog.accept());
  await Promise.all([page.waitForEvent("load"), upload({ app: "zaoan-hub", schemaVersion: 1, state: backup })]);
  await ready(page);
  await page.locator('[data-view-link="contacts"]').click();
  assert.match(await page.locator("#contacts-list").textContent(), /<img src=x>/);
  assert.equal(await page.locator("#contacts-list img, #contacts-list script").count(), 0);
  await page.locator('[data-view-link="today"]').click();
  assert.equal(await page.locator("#campaign-sender").inputValue(), "");
  assert.equal(await page.locator("#campaign-message").inputValue(), "還原的祝福");
});

test("shared-device mode moves the current draft out of permanent storage", async (t) => {
  const { page } = await setup(t);
  await page.goto(BASE);
  await ready(page);
  await page.locator("#campaign-message").fill("共用電腦上的祝福");
  await page.locator('[data-view-link="settings"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await Promise.all([page.waitForEvent("load"), page.locator("#privacy-mode-button").click()]);
  await ready(page);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STATE_KEY), null);
  assert.equal(await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).campaign.message, STATE_KEY), "共用電腦上的祝福");
  assert.equal(await page.locator("#draft-status").textContent(), "已儲存於此分頁");
});

test("a stale tab cannot restore data removed by another tab's shared-device switch", async (t) => {
  const { context, page } = await setup(t);
  await page.goto(BASE);
  await ready(page);
  await page.locator("#campaign-message").fill("原本的裝置草稿");
  const second = await context.newPage();
  await second.goto(BASE);
  await ready(second);
  await second.locator('[data-view-link="settings"]').click();
  second.once("dialog", (dialog) => dialog.accept());
  await Promise.all([second.waitForEvent("load"), second.locator("#privacy-mode-button").click()]);
  await ready(second);
  await page.locator("#campaign-message").fill("舊分頁的新輸入");
  assert.match(await page.locator("#storage-warning").textContent(), /其他分頁/);
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), STATE_KEY), null);
});

test("verified offline shell includes the guide and does not delete other apps' caches", async (t) => {
  const { context, page } = await setup(t, { serviceWorkers: "allow" });
  await page.goto(new URL("icon.svg", BASE).href);
  await page.evaluate(async () => {
    await caches.open("unrelated-app");
    await caches.open("zaoan-hub-shell:/another-app/:v1");
  });
  await page.goto(BASE);
  await ready(page);
  await page.waitForFunction(() => document.getElementById("offline-badge").textContent === "已準備好離線使用");
  const keys = await page.evaluate(() => caches.keys());
  assert.ok(keys.includes("unrelated-app"));
  assert.ok(keys.includes("zaoan-hub-shell:/another-app/:v1"));
  await page.locator("#campaign-message").fill("離線也保留的祝福");
  await context.setOffline(true);
  await page.reload();
  await ready(page);
  assert.equal(await page.locator("#campaign-message").inputValue(), "離線也保留的祝福");
  await page.goto(new URL("guide.html", BASE).href);
  assert.equal(await page.locator(".guide-step").count(), 3);
  await page.waitForFunction(() => document.getElementById("offline-badge").textContent === "已準備好離線使用");
  assert.equal(await page.evaluate(async () => { try { await fetch("./not-in-shell.json"); return true; } catch { return false; } }), false);
});

test("subdirectory releases stay coherent until accepted; failed installs retain the old shell", async (t) => {
  const http = require("node:http");
  const appDir = path.resolve(__dirname, "../app");
  const allowed = new Set(await fs.readdir(appDir));
  let release = 1;
  let failInstall = false;
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const name = url.pathname.slice("/fixture/".length) || "index.html";
    if (!url.pathname.startsWith("/fixture/") || !allowed.has(name)) { response.writeHead(404).end(); return; }
    if (failInstall && name === "state.js") { response.writeHead(503).end(); return; }
    try {
      let body = await fs.readFile(path.join(appDir, name));
      if (name === "sw.js") body = Buffer.from(body.toString().replace(/const CACHE_VERSION = "[^"]+";/, `const CACHE_VERSION = "fixture-${release}";`));
      if (name.endsWith(".html")) body = Buffer.from(body.toString().replace("<body>", `<body data-release="${release}">`));
      const type = name.endsWith(".js") ? "application/javascript" : name.endsWith(".css") ? "text/css" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".webmanifest") ? "application/manifest+json" : "text/html";
      response.writeHead(200, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store" });
      response.end(body);
    } catch { response.writeHead(500).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const { page } = await setup(t, { serviceWorkers: "allow" });
  const url = `http://127.0.0.1:${server.address().port}/fixture/`;
  failInstall = true;
  await page.goto(new URL("guide.html", url).href);
  await page.waitForFunction(() => document.getElementById("offline-badge").textContent.includes("離線準備失敗"));
  failInstall = false;
  await page.goto(url);
  await ready(page);
  await page.waitForFunction(() => document.getElementById("offline-badge").textContent === "已準備好離線使用");
  await page.locator("#campaign-message").fill("跨版本保留這句祝福");
  const editingTab = await page.context().newPage();
  await editingTab.goto(url);
  await ready(editingTab);
  await editingTab.locator('[data-view-link="contacts"]').click();
  await editingTab.locator("#contact-name").fill("尚未新增的親友");
  failInstall = true;
  release = 2;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await new Promise((resolve, reject) => {
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker.addEventListener("statechange", () => { if (worker.state === "redundant") resolve(); });
      }, { once: true });
      registration.update().catch(reject);
    });
  });
  await page.reload();
  await ready(page);
  assert.equal(await page.locator("body").getAttribute("data-release"), "1");
  failInstall = false;
  release = 3;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.locator("#update-notice").waitFor({ state: "visible" });
  await page.reload();
  await ready(page);
  assert.equal(await page.locator("body").getAttribute("data-release"), "1", "A reload before consent still serves the old coherent release");
  await page.locator("#update-notice").waitFor({ state: "visible" });
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#update-button").click();
  await page.waitForFunction(() => document.body.dataset.release === "3");
  await ready(page);
  assert.equal(await page.locator("#campaign-message").inputValue(), "跨版本保留這句祝福");
  assert.equal(await editingTab.locator("body").getAttribute("data-release"), "1", "Updating another tab must not erase an unsubmitted form");
  assert.equal(await editingTab.locator("#contact-name").inputValue(), "尚未新增的親友");
  assert.match(await editingTab.locator("#status-box").textContent(), /尚有未新增/);
  const keys = await page.evaluate(() => caches.keys());
  assert.ok(keys.includes("zaoan-hub-shell:/fixture/:fixture-3"));
  assert.ok(!keys.includes("zaoan-hub-shell:/fixture/:fixture-1"));
});

test("legacy network-HTML/cache-first-script clients can upgrade without clearing their contacts", async (t) => {
  const http = require("node:http");
  const appDir = path.resolve(__dirname, "../app");
  const allowed = new Set(await fs.readdir(appDir));
  let legacy = true;
  const oldWorker = `
    const paths = ["./", "./index.html", "./app.js", "./pwa.js", "./data-transfer.js", "./privacy.js", "./storage.js"];
    const urls = paths.map(path => new URL(path, self.registration.scope).href);
    self.addEventListener("install", event => event.waitUntil(caches.open("legacy-shell").then(cache => cache.addAll(urls)).then(() => self.skipWaiting())));
    self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
    self.addEventListener("fetch", event => {
      const url = new URL(event.request.url); url.search = "";
      if (!urls.includes(url.href)) return;
      if (event.request.mode === "navigate") { event.respondWith(fetch(event.request).catch(() => caches.match(url.href))); return; }
      event.respondWith(caches.match(url.href).then(cached => cached || fetch(event.request)));
    });`;
  const server = http.createServer(async (request, response) => {
    const name = new URL(request.url, "http://localhost").pathname.slice(1) || "index.html";
    if (!allowed.has(name)) { response.writeHead(404).end(); return; }
    try {
      let body = await fs.readFile(path.join(appDir, name));
      if (legacy && name === "sw.js") body = Buffer.from(oldWorker);
      if (legacy && name === "index.html") body = Buffer.from('<!doctype html><html><body><h1>Legacy shell</h1><script src="./pwa.js"></script></body></html>');
      if (legacy && name === "pwa.js") body = Buffer.from('navigator.serviceWorker.register("./sw.js");');
      if (legacy && ["app.js", "privacy.js", "data-transfer.js"].includes(name)) body = Buffer.from("/* Legacy app with no ZaoanApp interface. */");
      const type = name.endsWith(".js") ? "application/javascript" : name.endsWith(".css") ? "text/css" : name.endsWith(".svg") ? "image/svg+xml" : name.endsWith(".webmanifest") ? "application/manifest+json" : "text/html";
      response.writeHead(200, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store" }).end(body);
    } catch { response.writeHead(500).end(); }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); });
  const { page } = await setup(t, { serviceWorkers: "allow" });
  const url = `http://127.0.0.1:${server.address().port}/`;
  await page.goto(url);
  await page.waitForFunction(() => navigator.serviceWorker.controller);
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    contacts: [{ id: "c1", name: "保留的親友", channel: "line", note: "" }],
    groups: [], campaign: { message: "升級前的祝福", sender: "", selectedContactIds: ["c1"] }
  })), STATE_KEY);
  legacy = false;
  await page.reload();
  await page.waitForFunction(() => document.getElementById("update-button")?.textContent === "保留名單並更新");
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#update-button").click();
  await page.waitForFunction(() => window.ZaoanApp);
  await ready(page);
  assert.equal(await page.locator("#contact-count").textContent(), "1 位");
  assert.equal(await page.locator("#campaign-message").inputValue(), "升級前的祝福");
  assert.equal(await page.locator("#selected-count").textContent(), "記下 1 位");
});
