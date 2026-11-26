import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_BOUNDARY_TOKEN,
  capturePreviewSources,
  extractManualPreviewSource,
  markPreviewBoundary,
  removePreviewBoundary,
} from "./index.js";

test("converts a standalone more marker into a text token before Markdown parsing", () => {
  const source = ["Перший абзац.", "<!-- more -->", "Другий абзац."].join("\n");
  const expected = ["Перший абзац.", PREVIEW_BOUNDARY_TOKEN, "Другий абзац."].join("\n");
  assert.equal(markPreviewBoundary(source), expected);
});

test("does not convert a more marker inside fenced code", () => {
  const source = ["~~~md", "<!-- more -->", "~~~", "Текст"].join("\n");
  assert.equal(markPreviewBoundary(source), source);
});

test("captures image embeds before the marker and excludes the body after it", () => {
  const source = markPreviewBoundary([
    "![[Evernote/Published/embedded/unknown_filename 11.gif]]",
    "<!-- more -->",
    "Текст повної статті.",
  ].join("\n"));
  assert.equal(
    extractManualPreviewSource(source),
    [
      "![[Evernote/Published/embedded/unknown_filename 11.gif]]",
      PREVIEW_BOUNDARY_TOKEN,
    ].join("\n"),
  );
});

test("removes the token from the rendered article tree", () => {
  const tree = {
    type: "root",
    children: [
      { type: "text", value: "Початок " + PREVIEW_BOUNDARY_TOKEN + " продовження" },
      { type: "text", value: PREVIEW_BOUNDARY_TOKEN },
    ],
  };
  removePreviewBoundary(tree);
  assert.deepEqual(tree.children, [{ type: "text", value: "Початок  продовження" }]);
});


test("captures the full Markdown source even when no manual marker exists", () => {
  const file = {
    value: "---\ntitle: Solo media\n---\n![[embedded/solo.gif]]",
    data: {},
  };
  capturePreviewSources(file);
  assert.equal(file.data.previewSource, file.value);
  assert.equal(file.data.manualPreviewSource, undefined);
});

test("captures both the full note and manual preview prefix when a marker exists", () => {
  const file = {
    value: [
      "---",
      "title: Manual preview",
      "---",
      "![[embedded/cover.jpg]]",
      PREVIEW_BOUNDARY_TOKEN,
      "The rest of the note.",
    ].join("\n"),
    data: {},
  };
  capturePreviewSources(file);
  assert.equal(file.data.previewSource, file.value);
  assert.equal(
    file.data.manualPreviewSource,
    [
      "---",
      "title: Manual preview",
      "---",
      "![[embedded/cover.jpg]]",
      PREVIEW_BOUNDARY_TOKEN,
    ].join("\n"),
  );
});
