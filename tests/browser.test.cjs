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
      assert.equal(await page.locator(`#${view}`).isVisible(), true);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${view} fits ${width}px`);
    }
    await page.locator('[data-view-link="today"]').click();
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
