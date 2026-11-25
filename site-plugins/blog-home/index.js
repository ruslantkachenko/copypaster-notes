import { h } from "preact";
import { htmlToJsx } from "@quartz-community/utils/jsx";
import { resolveRelative, slugTag } from "@quartz-community/utils/path";

const INTERNAL_TAGS = new Set(["published", "note"]);
const PREVIEW_MARKER = /^\s*<!--\s*more\s*-->\s*$/i;
const PREVIEW_BOUNDARY_TOKEN = "COPypasterManualPreviewBoundary9F61D2";
const PUBLISHED_SOURCE_PREFIX = "Evernote/Published/";

function pageTags(page) {
  const tags = page.frontmatter?.tags ?? [];
  return Array.isArray(tags) ? tags.map(String) : [];
}

function isPublished(page) {
  return pageTags(page).some((tag) => tag.toLowerCase() === "published");
}

function createdDate(page) {
  const value = page.dates?.created ?? page.frontmatter?.created;
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function stripFrontmatter(source) {
  return String(source ?? "").replace(/^---[\s\S]*?---\s*/, "");
}

function findManualPreviewMarker(source) {
  const text = String(source ?? "");
  // The transformer token survives Quartz's plain-text extraction unchanged.
  const tokenIndex = text.indexOf(PREVIEW_BOUNDARY_TOKEN);
  if (tokenIndex >= 0) return tokenIndex;

  // Keep direct Markdown parsing available for unit tests and fallback cases.
  const lines = text.split("\n");
  let offset = 0;
  let fenceCharacter = null;
  let fenceLength = 0;

  for (const lineWithEnding of lines) {
    const line = lineWithEnding.replace(/\r$/, "");
    const trimmed = line.trimStart();
    const markerCharacter = trimmed[0];
    let markerLength = 0;
    if (markerCharacter === "`" || markerCharacter === "~") {
      while (trimmed[markerLength] === markerCharacter) markerLength += 1;
    }

    if (markerLength >= 3) {
      if (fenceCharacter === null) {
        fenceCharacter = markerCharacter;
        fenceLength = markerLength;
      } else if (markerCharacter === fenceCharacter && markerLength >= fenceLength) {
        fenceCharacter = null;
        fenceLength = 0;
      }
    } else if (fenceCharacter === null && PREVIEW_MARKER.test(line)) {
      return offset;
    }

    offset += lineWithEnding.length + 1;
  }

  return -1;
}

function cleanManualText(source) {
  return String(source ?? "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_match, target, alias) =>
      (alias || target).trim(),
    )
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/^\s*[-*]\s+\[[ xX]\]\s+/gm, "")
    .replace(/[>*_~\x60]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizePublishedAssetPath(target) {
  const cleanTarget = String(target ?? "").trim();
  const delimiterIndex = cleanTarget.search(/[|#]/);
  let path = (delimiterIndex === -1 ? cleanTarget : cleanTarget.slice(0, delimiterIndex)).trim();
  path = path.replace(/\\/g, "/").replace(/^\.?\//, "");

  if (path.startsWith(PUBLISHED_SOURCE_PREFIX)) {
    path = path.slice(PUBLISHED_SOURCE_PREFIX.length);
  }

  return path;
}

function imageBlockFromToken(match) {
  let target;
  let alt;

  if (match.startsWith("![[")) {
    const value = match.slice(3, -2);
    const separator = value.indexOf("|");
    target = separator === -1 ? value : value.slice(0, separator);
    alt = separator === -1 ? "" : value.slice(separator + 1).trim();
  } else {
    const parsed = match.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (!parsed) return null;
    alt = parsed[1];
    target = parsed[2].trim();
  }

  const path = normalizePublishedAssetPath(target);
  if (!/\.(?:png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(path)) return null;

  const fileName = path.split("/").pop() ?? path;
  return { type: "image", target: path, alt: alt || fileName };
}

/**
 * Returns null when the note has no manual marker. An empty array means
 * the marker is present at the very beginning, so the card has no preview.
 */
export function parseManualPreview(source) {
  const withoutFrontmatter = stripFrontmatter(source);
  const markerIndex = findManualPreviewMarker(withoutFrontmatter);
  if (markerIndex < 0) return null;

  const previewSource = withoutFrontmatter.slice(0, markerIndex).trim();
  if (!previewSource) return [];

  const blocks = [];
  const tokenPattern = /!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\)/g;
  let previousIndex = 0;
  let match;

  const addText = (text) => {
    const cleaned = cleanManualText(text);
    if (!cleaned) return;

    const last = blocks[blocks.length - 1];
    if (last?.type === "text") {
      last.text += "\n" + cleaned;
    } else {
      blocks.push({ type: "text", text: cleaned });
    }
  };

  while ((match = tokenPattern.exec(previewSource)) !== null) {
    addText(previewSource.slice(previousIndex, match.index));

    const image = imageBlockFromToken(match[0]);
    if (image) {
      blocks.push(image);
    } else {
      const value = match[0].startsWith("![[" ) ? match[0].slice(3, -2) : match[0];
      const fallback = value.split("|").pop()?.trim() ?? "";
      addText(fallback);
    }

    previousIndex = match.index + match[0].length;
  }

  addText(previewSource.slice(previousIndex));
  return blocks;
}

function plainExcerpt(page) {
  const clean = (source) =>
    String(source ?? "")
      .trim()
      .replace(/^---[\s\S]*?---\s*/m, "")
      .replace(/!\[\[([^\]]*)\]\]/g, "")
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, alias) => alias || target)
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/[>*_~\x60]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const candidates = [clean(page.description), clean(page.text)].filter((text) =>
    /[\p{L}\p{N}]/u.test(text),
  );
  const text = candidates.sort((a, b) => b.length - a.length)[0] ?? "";
  if (!text) return "";
  return text.length > 320 ? text.slice(0, 317).trimEnd() + "…" : text;
}

function renderManualPreview(blocks, homeSlug) {
  const children = [];

  blocks.forEach((block, index) => {
    if (block.type === "image") {
      children.push(
        h("img", {
          class: "blog-post-excerpt-image",
          src: resolveRelative(homeSlug, block.target),
          alt: block.alt,
          loading: "lazy",
          key: "image-" + index,
        }),
      );
      return;
    }

    const paragraphs = block.text.split(/\n\s*\n/).filter(Boolean);
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const lines = paragraph.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const content = [];
      lines.forEach((line, lineIndex) => {
        if (lineIndex > 0) content.push(h("br", { key: "br-" + lineIndex }));
        content.push(line);
      });
      children.push(
        h("p", { class: "blog-post-excerpt-text", key: "text-" + index + "-" + paragraphIndex }, content),
      );
    });
  });

  return children.length
    ? h("div", { class: "blog-post-excerpt blog-post-excerpt-manual" }, children)
    : null;
}

function renderPreview(page, homeSlug) {
  for (const source of [page.text, page.description]) {
    const manual = parseManualPreview(source);
    if (manual !== null) return renderManualPreview(manual, homeSlug);
  }

  const excerpt = plainExcerpt(page);
  return excerpt ? h("p", { class: "blog-post-excerpt" }, excerpt) : null;
}

function formatDate(date, locale) {
  return new Intl.DateTimeFormat(locale || "uk-UA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function BlogHomeBody({ fileData, tree, allFiles, cfg }) {
  const intro = htmlToJsx(tree);
  const posts = allFiles
    .filter((page) => page.slug !== "index" && isPublished(page))
    .map((page) => ({ page, date: createdDate(page) }))
    .filter((item) => item.date)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const cards = posts.map(({ page, date }) => {
    const title = page.frontmatter?.title ?? "Без назви";
    const href = resolveRelative(fileData.slug, page.slug);
    const tags = pageTags(page).filter((tag) => !INTERNAL_TAGS.has(tag.toLowerCase()));
    const preview = renderPreview(page, fileData.slug);

    return h(
      "article",
      { class: "blog-post-preview", "data-blog-tags": JSON.stringify(tags), key: page.slug },
      [
        h("p", { class: "blog-post-date" }, formatDate(date, cfg.locale)),
        h("h2", { class: "blog-post-title" }, h("a", { href, class: "internal" }, title)),
        preview,
        tags.length
          ? h(
              "div",
              { class: "blog-post-tags" },
              tags.map((tag) =>
                h(
                  "a",
                  {
                    class: "blog-tag",
                    href: resolveRelative(fileData.slug, "tags/" + slugTag(tag)),
                    key: tag,
                  },
                  tag,
                ),
              ),
            )
          : null,
        h("a", { class: "blog-read-more internal", href }, "Читати далі →"),
      ],
    );
  });

  return h("div", { class: "blog-home" }, [
    h("section", { class: "blog-intro" }, intro),
    h("section", { class: "blog-feed", "aria-label": "Стрічка публікацій" }, [
      h("h2", { class: "blog-feed-heading" }, "Публікації"),
      cards.length
        ? cards
        : h("p", { class: "blog-feed-empty" }, "Публікацій із тегом published поки немає."),
      h(
        "p",
        { class: "blog-filter-empty", hidden: true },
        "Немає публікацій із вибраним поєднанням тем.",
      ),
    ]),
  ]);
}

BlogHomeBody.css = [
  ".blog-home { width: 100%; }",
  ".blog-intro { margin-bottom: 3rem; }",
  ".blog-intro > :first-child { margin-top: 0; }",
  ".blog-intro img { max-width: 100%; height: auto; border-radius: 3px; }",
  ".blog-feed-heading { margin: 0 0 1.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--lightgray); font-size: 1.35rem; }",
  ".blog-post-preview { padding: 0 0 2.25rem; margin: 0 0 2.25rem; border-bottom: 1px solid var(--lightgray); }",
  ".blog-post-date { margin: 0 0 0.55rem; color: var(--gray); font-size: 0.88rem; }",
  ".blog-post-title { margin: 0 0 0.9rem; font-size: 1.35rem; line-height: 1.35; }",
  ".blog-post-title a { color: var(--dark); text-decoration: none; }",
  ".blog-post-title a:hover, .blog-read-more:hover { color: var(--secondary); }",
  ".blog-post-excerpt { margin: 0 0 1rem; line-height: 1.75; }",
  ".blog-post-excerpt-text { margin: 0 0 0.65rem; }",
  ".blog-post-excerpt-text:last-child { margin-bottom: 0; }",
  ".blog-post-excerpt-image { display: block; max-width: 100%; max-height: 28rem; width: auto; height: auto; margin: 0 0 0.85rem; border-radius: 3px; }",
  ".blog-post-tags { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 0 0 1rem; }",
  ".blog-tag { display: inline-flex; align-items: center; padding: 0.2rem 0.7rem; border: 0; border-radius: 999px; color: var(--darkgray); background: var(--highlight); font-size: 0.78rem; text-decoration: none; transition: background 0.15s ease, color 0.15s ease; }",
  ".blog-tag:hover { color: var(--dark); background: var(--lightgray); }",
  ".blog-read-more { display: inline-block; color: var(--secondary); font-size: 0.9rem; font-weight: 600; text-decoration: none; }",
  ".blog-feed-empty { color: var(--gray); font-style: italic; }",
].join("\n");

export default function BlogHomePageType() {
  return {
    name: "BlogHomePage",
    priority: 100,
    match: ({ slug }) => slug === "index",
    layout: "blog-home",
    body: () => BlogHomeBody,
  };
}
