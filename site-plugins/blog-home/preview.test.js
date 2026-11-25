import assert from "node:assert/strict";
import test from "node:test";
import { parseManualPreview } from "./index.js";

test("no marker keeps automatic preview behavior available", () => {
  assert.equal(parseManualPreview("Звичайний текст без маркера"), null);
});

test("manual marker keeps the exact text before it, including separate lines", () => {
  const result = parseManualPreview([
    "---", 'title: "Тест"', "---",
    "Перший рядок анонсу.",
    "Другий рядок анонсу.",
    "",
    "<!-- more -->",
    "",
    "Повний текст статті.",
  ].join("\n"));
  assert.deepEqual(result, [
    { type: "text", text: "Перший рядок анонсу.\nДругий рядок анонсу." },
  ]);
});

test("Quartz-preserved token marks the manual preview boundary", () => {
  const result = parseManualPreview([
    "Перший абзац.",
    "COPypasterManualPreviewBoundary9F61D2",
    "Другий абзац.",
  ].join("\n"));
  assert.deepEqual(result, [{ type: "text", text: "Перший абзац." }]);
});

test("marker at the beginning deliberately hides the preview", () => {
  assert.deepEqual(parseManualPreview("<!-- more -->\nПовний текст статті."), []);
});

test("image-only preview resolves the published attachment path", () => {
  const result = parseManualPreview([
    "![[Evernote/Published/embedded/photo.gif]]",
    "<!-- more -->",
    "Після маркера",
  ].join("\n"));
  assert.deepEqual(result, [
    { type: "image", target: "embedded/photo.gif", alt: "photo.gif" },
  ]);
});

test("text and image blocks retain their order", () => {
  const result = parseManualPreview([
    "Підпис до зображення",
    "![[embedded/example.png|Приклад]]",
    "<!-- more -->",
  ].join("\n"));
  assert.deepEqual(result, [
    { type: "text", text: "Підпис до зображення" },
    { type: "image", target: "embedded/example.png", alt: "Приклад" },
  ]);
});

test("a marker inside a fenced code example is ignored", () => {
  assert.equal(
    parseManualPreview(["~~~md", "<!-- more -->", "~~~", "Це не маркер а приклад"].join("\n")),
    null,
  );
});
