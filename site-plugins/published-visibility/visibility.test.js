import assert from "node:assert/strict";
import test from "node:test";
import { markUnpublishedAsUnlisted } from "./index.js";

function file(slug, frontmatter, extra = {}) {
  return { data: { slug, frontmatter, ...extra } };
}

test("a note without the published tag is marked unlisted", () => {
  const input = file("Межигорье-vs-Госбюджет", { tags: ["note", "revolution"] });
  markUnpublishedAsUnlisted(input);
  assert.equal(input.data.unlisted, true);
});

test("a note with the published tag remains listed", () => {
  const input = file("иллюзия-звука", { tags: ["GIF", "published", "sound"] });
  markUnpublishedAsUnlisted(input);
  assert.equal(input.data.unlisted, false);
});

test("published tag comparison is case-insensitive", () => {
  const input = file("test-post", { tags: ["Published"] });
  markUnpublishedAsUnlisted(input);
  assert.equal(input.data.unlisted, false);
});

test("root index remains listed without a published tag", () => {
  const input = file("index", { title: "Записки копіпастера" });
  markUnpublishedAsUnlisted(input);
  assert.equal(input.data.unlisted, undefined);
});

test("explicitly unlisted pages stay unlisted even when published", () => {
  const input = file("hidden-post", { tags: ["published"], unlisted: true });
  markUnpublishedAsUnlisted(input);
  assert.equal(input.data.unlisted, true);
});

test("a non-published page stays unlisted even if frontmatter says false", () => {
  const input = file("draft-post", { tags: ["note"], unlisted: false });
  markUnpublishedAsUnlisted(input);
  assert.equal(input.data.unlisted, true);
});
