import assert from "node:assert/strict";
import test from "node:test";
import { parseManualPreview } from "./index.js";

test("no marker keeps automatic preview behavior available", () => {
  assert.equal(parseManualPreview("Звичайний текст без маркера"), null);
});

test("manual marker keeps the exact text before it, including separate lines", () => {
  const result = parseManualPreview(`---
title: "Тест"
---
Перший рядок анонсу.
Другий рядок анонсу.

<!-- more -->

Повний текст статті.`);
  assert.deepEqual(result, [
    { type: "text", text: "Перший рядок анонсу.\nДругий рядок анонсу." },
  ]);
});

test("marker at the beginning deliberately hides the preview", () => {
  assert.deepEqual(parseManualPreview("<!-- more -->\nПовний текст статті."), []);
});

test("image-only preview resolves the published attachment path", () => {
  const result = parseManualPreview(
    "![[Evernote/Published/embedded/photo.gif]]\n<!-- more -->\nПісля маркера",
  );
  assert.deepEqual(result, [
    { type: "image", target: "embedded/photo.gif", alt: "photo.gif" },
  ]);
});

test("text and image blocks retain their order", () => {
  const result = parseManualPreview(
    "Підпис до зображення\n![[embedded/example.png|Приклад]]\n<!-- more -->",
  );
  assert.deepEqual(result, [
    { type: "text", text: "Підпис до зображення" },
    { type: "image", target: "embedded/example.png", alt: "Приклад" },
  ]);
});

test("a marker inside a fenced code example is ignored", () => {
  assert.equal(
    parseManualPreview("~~~md\n<!-- more -->\n~~~\nЦе не маркер а приклад"),
    null,
  );
});
