import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_BOUNDARY_TOKEN,
  markPreviewBoundary,
  removePreviewBoundary,
} from "./index.js";

test("converts a standalone more marker into a text token before Markdown parsing", () => {
  const result = markPreviewBoundary("Перший абзац.\\n<!-- more -->\\nДругий абзац.");
  assert.equal(result, "Перший абзац.\\n" + PREVIEW_BOUNDARY_TOKEN + "\\nДругий абзац.");
});

test("does not convert a more marker inside fenced code", () => {
  const source = "~~~md\\n<!-- more -->\\n~~~\\nТекст";
  assert.equal(markPreviewBoundary(source), source);
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
