import assert from "node:assert/strict";
import test from "node:test";
import { parseAutomaticMediaPreview, parseManualPreview, resolvePreviewAssetUrl } from "./index.js";

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

test("image attachment paths match Quartz's published slugified filenames", () => {
  const result = parseManualPreview([
    "![[Evernote/Published/embedded/unknown_filename 11.gif]]",
    "<!-- more -->",
    "Текст після маркера.",
  ].join("\n"));
  assert.deepEqual(result, [
    { type: "image", target: "embedded/unknown_filename-11.gif", alt: "unknown_filename 11.gif" },
  ]);
});

test("short image wikilinks resolve to assets inside embedded", () => {
  const allSlugs = [
    "index",
    "заметки-на-полях",
    "embedded/светофор.jpg",
  ];
  assert.equal(
    resolvePreviewAssetUrl("index", "светофор.jpg", allSlugs),
    "./embedded/светофор.jpg",
  );
});

test("explicit embedded paths keep resolving from the homepage", () => {
  const allSlugs = [
    "index",
    "embedded/unknown_filename-11.gif",
  ];
  assert.equal(
    resolvePreviewAssetUrl("index", "embedded/unknown_filename-11.gif", allSlugs),
    "./embedded/unknown_filename-11.gif",
  );
});


test("a single image at the start is shown as a complete media preview", () => {
  assert.deepEqual(
    parseAutomaticMediaPreview("![[Evernote/Published/embedded/solo photo.gif]]"),
    {
      blocks: [{ type: "image", target: "embedded/solo-photo.gif", alt: "solo photo.gif" }],
      complete: true,
    },
  );
});

test("an image-first note with text after it previews only the first image", () => {
  assert.deepEqual(
    parseAutomaticMediaPreview("![[embedded/photo.jpg]]\n\nОписовий текст після зображення."),
    {
      blocks: [{ type: "image", target: "embedded/photo.jpg", alt: "photo.jpg" }],
      complete: false,
    },
  );
});

test("an image gallery previews only its first image", () => {
  const result = parseAutomaticMediaPreview([
    "![[embedded/first.jpg]]",
    "![[embedded/second.jpg]]",
    "![[embedded/third.jpg]]",
  ].join("\n"));
  assert.deepEqual(result, {
    blocks: [{ type: "image", target: "embedded/first.jpg", alt: "first.jpg" }],
    complete: false,
  });
});

test("a YouTube Markdown embed is rendered as an iframe media preview", () => {
  assert.deepEqual(
    parseAutomaticMediaPreview("![](https://www.youtube.com/watch?v=dQw4w9WgXcQ)"),
    {
      blocks: [{
        type: "iframe",
        target: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        alt: "Вбудоване відео",
        mediaKind: "video",
      }],
      complete: true,
    },
  );
});

test("an Obsidian video-file embed is detected as video", () => {
  assert.deepEqual(
    parseAutomaticMediaPreview("![[Evernote/Published/embedded/short clip.mp4]]"),
    {
      blocks: [{ type: "video", target: "embedded/short-clip.mp4", alt: "short clip.mp4" }],
      complete: true,
    },
  );
});

test("a standalone iframe is shown as the first media block and later text is excluded", () => {
  assert.deepEqual(
    parseAutomaticMediaPreview([
      '<iframe src="https://player.example/embed/123" title="Відео"></iframe>',
      "Пояснення після вбудованого відео.",
    ].join("\n\n")),
    {
      blocks: [{
        type: "iframe",
        target: "https://player.example/embed/123",
        alt: "Відео",
        mediaType: undefined,
        attributes: { src: "https://player.example/embed/123", title: "Відео" },
        mediaKind: undefined,
      }],
      complete: false,
    },
  );
});

test("a video-only HTML embed is detected", () => {
  const result = parseAutomaticMediaPreview('<video src="embedded/clip.mp4" controls></video>');
  assert.equal(result.blocks[0].type, "video");
  assert.equal(result.blocks[0].target, "embedded/clip.mp4");
  assert.equal(result.complete, true);
});

test("text-first notes keep the existing automatic text excerpt path", () => {
  assert.equal(
    parseAutomaticMediaPreview("Спочатку йде описовий текст.\n\n![[embedded/photo.jpg]]"),
    null,
  );
});

test("manual more markers still take precedence and can render video embeds", () => {
  assert.deepEqual(
    parseManualPreview("![[embedded/clip.mp4]]\n<!-- more -->\nТекст після маркера"),
    [{ type: "video", target: "embedded/clip.mp4", alt: "clip.mp4" }],
  );
});
