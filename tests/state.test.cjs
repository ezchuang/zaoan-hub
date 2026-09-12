const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = { window: {} };
vm.runInNewContext(readFileSync(path.join(__dirname, "../app/state.js"), "utf8"), context);
const state = context.window.ZaoanState;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("empty defaults contain no invented contacts or sender", () => {
  const empty = state.createEmpty();
  assert.equal(empty.contacts.length, 0);
  assert.equal(empty.campaign.sender, "");
  assert.deepEqual(plain(state.normalize(empty)), plain(empty));
});

test("valid legacy state migrates export-only mode without losing names or selected contacts", () => {
  const old = state.createEmpty();
  old.contacts.push({ id: "c1", name: "王阿姨", channel: "line", note: "喜歡花" });
  old.groups.push({ id: "g1", name: "親友", contactIds: ["c1"] });
  Object.assign(old.campaign, { selectedGroupId: "g1", selectedContactIds: ["c1"], sendMode: "official-channel" });
  const normalized = state.normalize(old);
  assert.equal(normalized.campaign.sendMode, "share-sheet");
  assert.deepEqual(plain(normalized.contacts), plain(old.contacts));
  assert.deepEqual(plain(normalized.campaign.selectedContactIds), ["c1"]);
});

test("intentionally empty draft fields survive a backup round-trip", () => {
  const draft = state.createEmpty();
  Object.assign(draft.campaign, { title: "", sender: "", message: "" });
  assert.deepEqual(plain(state.normalize(draft)), plain(draft));
});

test("unrelated or malformed JSON cannot silently replace real data with an empty state", () => {
  for (const invalid of [null, [], {}, "hello", { contacts: [], groups: [] }, { contacts: [null], groups: [], campaign: {} }]) {
    assert.throws(() => state.normalize(invalid));
  }
  assert.throws(() => state.validatePayloadMetadata({ app: "other" }));
  assert.throws(() => state.validatePayloadMetadata({ schemaVersion: 2 }));
  state.validatePayloadMetadata({ app: "zaoan-hub", schemaVersion: 1 });
});

test("invalid IDs, duplicate IDs, dangling references, invalid channels and nontext names are rejected", () => {
  for (const mutate of [
    (s) => { s.contacts[0].id = 'x" onclick="alert(1)'; },
    (s) => { s.contacts.push({ ...s.contacts[0] }); },
    (s) => { s.contacts[0].channel = "__proto__"; },
    (s) => { s.contacts[0].name = { value: "not text" }; },
    (s) => { s.groups.push({ id: "g1", name: "失效名單", contactIds: ["missing"] }); },
    (s) => { s.campaign.selectedGroupId = "missing"; },
    (s) => { s.campaign.selectedContactIds = ["missing"]; },
    (s) => { s.campaign.selectedContactIds = "c1"; }
  ]) {
    const input = state.createEmpty();
    input.contacts.push({ id: "c1", name: "親友", channel: "line", note: "" });
    mutate(input);
    assert.throws(() => state.normalize(input));
  }
});

test("backup limits match the UI and reject oversized text or lists", () => {
  const input = state.createEmpty();
  input.campaign.message = "a".repeat(501);
  assert.throws(() => state.normalize(input));
  input.campaign.message = "a".repeat(500);
  state.normalize(input);
  input.contacts = Array.from({ length: 501 }, (_, i) => ({ id: `c${i}`, name: "親友", channel: "line" }));
  assert.throws(() => state.normalize(input));
});
