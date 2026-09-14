const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = { window: {} };
for (const file of ["state.js", "greetings.js"]) vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../app", file), "utf8"), context);
const { ZaoanState: state, ZaoanGreetings: greetings } = context.window;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("recommendations are stable within a local day, change tomorrow and cycle without duplicates", () => {
  const morning = new Date(2026, 8, 13, 0, 5);
  assert.deepEqual(plain(greetings.recommendation(morning)), plain(greetings.recommendation(new Date(2026, 8, 13, 23, 55))));
  assert.notEqual(greetings.recommendation(morning).backgroundId, greetings.recommendation(new Date(2026, 8, 14)).backgroundId);
  assert.notEqual(greetings.recommendation(morning).message, greetings.recommendation(new Date(2026, 8, 14)).message);
  const variants = Array.from({ length: greetings.count }, (_, index) => greetings.recommendation(morning, index));
  assert.equal(new Set(variants.map((item) => `${item.backgroundId}:${item.message}`)).size, greetings.count);
});

test("automatic refresh and next image preserve signatures, contacts and recipient selections", () => {
  const input = state.createEmpty();
  input.contacts = [{ id: "c1", name: "親友", channel: "line", note: "" }];
  input.campaign.sender = "美惠";
  input.campaign.selectedContactIds = ["c1"];
  const day = new Date(2026, 8, 13);
  assert.equal(greetings.refresh(input, day), true);
  assert.equal(greetings.refresh(input, day), false);
  const first = plain(input.greeting);
  greetings.next(input, day);
  assert.notDeepEqual(plain(input.greeting), first);
  assert.equal(input.campaign.sender, "美惠");
  assert.deepEqual(plain(input.campaign.selectedContactIds), ["c1"]);
  assert.equal(input.contacts.length, 1);
  assert.deepEqual(plain(state.normalize(input)), plain(input));
  greetings.refresh(input, new Date(2026, 8, 14));
  assert.equal(input.greeting.date, "2026-09-14");
  assert.equal(input.greeting.variant, 0);
});

test("legacy and intentionally blank custom messages are never replaced by a new day or background", () => {
  for (const message of ["", "自己寫的祝福"]) {
    const legacy = state.createEmpty();
    delete legacy.greeting;
    legacy.campaign.message = message;
    const input = state.normalize(legacy);
    assert.equal(input.greeting.mode, "custom");
    assert.equal(greetings.refresh(input, new Date(2026, 8, 14)), false);
    greetings.next(input);
    assert.equal(input.campaign.message, message);
    assert.equal(input.greeting.backgroundId, "lake");
  }
});

test("artwork metadata cannot introduce external URLs, invalid dates or unbounded variants", () => {
  for (const mutation of [
    { mode: "invalid" }, { backgroundId: "https://example.com/private.png" },
    { backgroundId: "__proto__" }, { date: "2026-02-30" }, { date: null },
    { variant: -1 }, { variant: 10000 }, { variant: 1.5 }, { variant: "1" }
  ]) {
    const input = state.createEmpty();
    Object.assign(input.greeting, mutation);
    assert.throws(() => state.normalize(input));
  }
});

test("every background is a checked-in PNG included in the offline shell", () => {
  const sw = fs.readFileSync(path.join(__dirname, "../app/sw.js"), "utf8");
  for (const asset of greetings.backgrounds) {
    assert.ok(asset.path.startsWith("./morning-") && asset.path.endsWith(".png"));
    const image = fs.readFileSync(path.join(__dirname, "../app", asset.path));
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.ok(sw.includes(`"${asset.path}"`));
    const input = state.createEmpty();
    input.greeting.backgroundId = asset.id;
    state.normalize(input);
  }
});
