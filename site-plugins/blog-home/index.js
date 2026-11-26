import { h } from "preact";
import { htmlToJsx } from "@quartz-community/utils/jsx";
import { resolveRelative, slugTag, slugifyFilePath, transformLink } from "@quartz-community/utils/path";

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

  // Quartz's Assets emitter slugifies copied files (spaces become hyphens,
  // letters become lowercase). Match that exact filename for the preview URL.
  return slugifyFilePath(path);
}

function videoEmbedUrl(target) {
  try {
    const url = new URL(target);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id) return "https://www.youtube.com/embed/" + id;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const id =
        url.searchParams.get("v") ||
        url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1];
      const playlist = url.searchParams.get("list");
      if (id && playlist) return "https://www.youtube.com/embed/" + id + "?list=" + encodeURIComponent(playlist);
      if (id) return "https://www.youtube.com/embed/" + id;
      if (playlist) return "https://www.youtube.com/embed/videoseries?list=" + encodeURIComponent(playlist);
    }

    if (host === "vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return "https://player.vimeo.com/video/" + id;
    }
  } catch {
    return null;
  }

  return null;
}

function htmlAttributes(source) {
  const attributes = {};
  const pattern = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function mediaBlockFromTarget(target, alt = "", explicitEmbed = false) {
  const cleanTarget = String(target ?? "").trim();
  if (!cleanTarget) return null;

  const providerUrl = videoEmbedUrl(cleanTarget);
  if (providerUrl) {
    return { type: "iframe", target: providerUrl, alt: alt || "Вбудоване відео", mediaKind: "video" };
  }

  const isExternal = /^https?:\/\//i.test(cleanTarget);
  if (isExternal && explicitEmbed) {
    return { type: "iframe", target: cleanTarget, alt: alt || "Вбудований матеріал" };
  }

  const pathForExtension = cleanTarget.split(/[?#]/)[0];
  const extension = pathForExtension.slice(pathForExtension.lastIndexOf(".")).toLowerCase();
  const originalPath = cleanTarget.replace(/\\/g, "/");
  const originalFileName = originalPath.split("/").pop() ?? originalPath;
  const publishedPath = isExternal ? cleanTarget : normalizePublishedAssetPath(cleanTarget);

  if (/\.(?:png|jpe?g|gif|webp|avif|bmp|jxl)$/i.test(extension)) {
    return { type: "image", target: publishedPath, alt: alt || originalFileName };
  }
  if (/\.(?:mp4|webm|ogv|avi|mov|flv|wmv|mkv|mpg|mpeg|3gp|m4v)$/i.test(extension)) {
    return { type: "video", target: publishedPath, alt: alt || originalFileName };
  }
  if (/\.(?:mp3|wav|m4a|ogg|oga|aac|flac)$/i.test(extension)) {
    return { type: "audio", target: publishedPath, alt: alt || originalFileName };
  }
  if (/\.pdf$/i.test(extension)) {
    return { type: "iframe", target: publishedPath, alt: alt || originalFileName, mediaKind: "document" };
  }
  if (/\.svg$/i.test(extension)) {
    return { type: "object", target: publishedPath, alt: alt || originalFileName, mediaType: "image/svg+xml" };
  }

  // A normal Markdown image can be hosted at an extension-less URL.
  if (isExternal && !explicitEmbed) {
    return { type: "image", target: cleanTarget, alt: alt || originalFileName };
  }

  return null;
}

function mediaBlockFromHtml(match) {
  const openingTag = match.match(/^<(iframe|video|audio|object|embed)\b([^>]*)>/i);
  if (!openingTag) return null;

  const tag = openingTag[1].toLowerCase();
  const attrs = htmlAttributes(openingTag[2]);
  let target = attrs.src || attrs.data;

  if (!target && tag === "video") {
    const sourceTag = match.match(/<source\b([^>]*)>/i);
    if (sourceTag) {
      const sourceAttrs = htmlAttributes(sourceTag[1]);
      target = sourceAttrs.src;
    }
  }

  if (!target) return null;

  const providerUrl = videoEmbedUrl(target);
  if (providerUrl) target = providerUrl;

  const type = tag === "object" ? "object" : tag === "embed" ? "embed" : tag;
  return {
    type,
    target: /^https?:\/\//i.test(target) || target.startsWith("/")
      ? target
      : normalizePublishedAssetPath(target),
    alt: attrs.title || attrs.alt || "Вбудований матеріал",
    mediaType: attrs.type,
    attributes: attrs,
    mediaKind: tag === "iframe" && /youtube|vimeo/i.test(target) ? "video" : undefined,
  };
}

function mediaBlockFromToken(match) {
  const token = String(match ?? "").trim();

  if (token.startsWith("<")) return mediaBlockFromHtml(token);

  if (token.startsWith("![[")) {
    const value = token.slice(3, -2);
    const separator = value.indexOf("|");
    const target = separator === -1 ? value : value.slice(0, separator);
    const alt = separator === -1 ? "" : value.slice(separator + 1).trim();
    return mediaBlockFromTarget(target, alt, true);
  }

  const parsed = token.match(/^!\[([^\]]*)\]\((<[^>]+>|[^)]+)\)$/);
  if (!parsed) return null;

  const alt = parsed[1];
  const rawTarget = parsed[2].replace(/^<|>$/g, "").trim();
  return mediaBlockFromTarget(rawTarget, alt, false);
}

function extractLeadingMediaToken(source) {
  const text = String(source ?? "").trimStart();

  const wikilink = text.match(/^!\[\[[^\]]+\]\]/);
  if (wikilink) return { token: wikilink[0], length: wikilink[0].length };

  const markdownImage = text.match(/^!\[[^\]]*\]\((?:<[^>]+>|[^)]+)\)/);
  if (markdownImage) return { token: markdownImage[0], length: markdownImage[0].length };

  const htmlStart = text.match(/^<(iframe|video|audio|object|embed)\b/i);
  if (htmlStart) {
    const tag = htmlStart[1];
    const openEnd = text.indexOf(">");
    if (openEnd < 0) return null;
    const opening = text.slice(0, openEnd + 1);
    if (/\/\s*>$/.test(opening)) return { token: opening, length: opening.length };

    const closePattern = new RegExp("</" + tag + "\\s*>", "i");
    const rest = text.slice(openEnd + 1);
    const close = rest.match(closePattern);
    if (close && close.index !== undefined) {
      const length = openEnd + 1 + close.index + close[0].length;
      return { token: text.slice(0, length), length };
    }

    return { token: opening, length: opening.length };
  }

  return null;
}

function hasMeaningfulRemainder(source) {
  return String(source ?? "")
    .replace(new RegExp(PREVIEW_BOUNDARY_TOKEN, "g"), "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/%%[\s\S]*?%%/g, "")
    .trim().length > 0;
}

/**
 * Detects a media-first note without an explicit manual marker.
 * The first media item becomes the complete teaser; any later content is left
 * for the full article. Text-first notes continue to use the normal excerpt.
 */
export function parseAutomaticMediaPreview(source) {
  const body = stripFrontmatter(source).split(PREVIEW_BOUNDARY_TOKEN)[0];
  const leading = extractLeadingMediaToken(body);
  if (!leading) return null;

  const media = mediaBlockFromToken(leading.token);
  if (!media) return null;

  const remainder = body.trimStart().slice(leading.length);
  const hasMoreContent = hasMeaningfulRemainder(remainder);

  return {
    blocks: [media],
    complete: !hasMoreContent,
  };
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
  const tokenPattern = /!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\)|<(iframe|video|audio|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>|<(?:iframe|video|audio|object|embed)\b[^>]*\/?\s*>/gi;
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

    const media = mediaBlockFromToken(match[0]);
    if (media) {
      blocks.push(media);
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

export function resolvePreviewAssetUrl(homeSlug, target, allSlugs) {
  // Match Quartz's CrawlLinks resolver: short wikilinks can refer to files
  // inside embedded/ (or another folder) without naming that folder.
  return transformLink(homeSlug, target, {
    strategy: "shortest",
    allSlugs,
  });
}

function resolvePreviewMediaSrc(homeSlug, target, allSlugs) {
  const value = String(target ?? "");
  if (/^(?:https?:)?\/\//i.test(value) || value.startsWith("/") || value.startsWith("data:")) {
    return value;
  }
  return resolvePreviewAssetUrl(homeSlug, value, allSlugs);
}

function renderMediaBlock(block, homeSlug, allSlugs, key) {
  const src = resolvePreviewMediaSrc(homeSlug, block.target, allSlugs);
  const attrs = block.attributes ?? {};

  if (block.type === "image") {
    return h("img", {
      class: "blog-post-excerpt-image",
      src,
      alt: block.alt,
      loading: "lazy",
      key,
    });
  }

  if (block.type === "video") {
    return h("video", {
      class: "blog-post-excerpt-video",
      src,
      controls: true,
      preload: "metadata",
      title: block.alt,
      key,
    });
  }

  if (block.type === "audio") {
    return h("audio", {
      class: "blog-post-excerpt-audio",
      src,
      controls: true,
      preload: "metadata",
      title: block.alt,
      key,
    });
  }

  if (block.type === "iframe") {
    const width = attrs.width || undefined;
    const height = attrs.height || undefined;
    return h("iframe", {
      class: "blog-post-excerpt-iframe" + (block.mediaKind === "document" ? " blog-post-excerpt-iframe-document" : ""),
      src,
      title: attrs.title || block.alt || "Вбудований матеріал",
      width,
      height,
      allow: attrs.allow || "autoplay; encrypted-media; picture-in-picture; fullscreen",
      allowFullScreen: attrs.allowfullscreen !== undefined || block.mediaKind === "video",
      loading: "lazy",
      frameBorder: attrs.frameborder || "0",
      referrerPolicy: "strict-origin-when-cross-origin",
      key,
    });
  }

  if (block.type === "object") {
    return h("object", {
      class: "blog-post-excerpt-object",
      data: src,
      type: block.mediaType || "image/svg+xml",
      "aria-label": block.alt,
      key,
    });
  }

  if (block.type === "embed") {
    return h("embed", {
      class: "blog-post-excerpt-embed",
      src,
      type: block.mediaType,
      title: block.alt,
      key,
    });
  }

  return null;
}

function renderManualPreview(blocks, homeSlug, allSlugs) {
  const children = [];

  blocks.forEach((block, index) => {
    if (block.type !== "text") {
      const media = renderMediaBlock(block, homeSlug, allSlugs, "media-" + index);
      if (media) children.push(media);
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

function renderPreview(page, homeSlug, allSlugs) {
  // Original Markdown keeps embeds that Quartz removes from page.text.
  const source = page.previewSource ?? page.manualPreviewSource;
  if (typeof source === "string") {
    const manual = parseManualPreview(source);
    if (manual !== null) return renderManualPreview(manual, homeSlug, allSlugs);

    const automaticMedia = parseAutomaticMediaPreview(source);
    if (automaticMedia !== null) {
      return renderManualPreview(automaticMedia.blocks, homeSlug, allSlugs);
    }
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

function BlogHomeBody({ ctx, fileData, tree, allFiles, cfg }) {
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
    const preview = renderPreview(page, fileData.slug, ctx.allSlugs ?? []);

    return h(
      "article",
      { class: "blog-post-preview", "data-blog-tags": JSON.stringify(tags), key: page.slug },
      [
        h("p", { class: "blog-post-date" }, formatDate(date, cfg.locale)),
        h("h2", { class: "blog-post-title" }, h("a", { href, class: "internal", "data-no-popover": "true" }, title)),
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
        h("a", { class: "blog-read-more internal", href, "data-no-popover": "true" }, "Читати далі →"),
      ],
    );
  });

  const introTitle = fileData.frontmatter?.title ?? cfg.pageTitle ?? "Записки копіпастера";

  return h("div", { class: "blog-home" }, [
    h("section", { class: "blog-intro" }, [
      h("details", { class: "blog-intro-disclosure" }, [
        h("summary", { class: "blog-intro-toggle" }, [
          h(
            "span",
            { class: "blog-intro-chevron-wrap", "aria-hidden": "true" },
            h(
              "svg",
              {
                xmlns: "http://www.w3.org/2000/svg",
                width: "12",
                height: "12",
                viewBox: "5 8 14 8",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2.2",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
                class: "blog-intro-chevron",
              },
              h("polyline", { points: "6 9 12 15 18 9" }),
            ),
          ),
          h("span", { class: "blog-intro-title" }, introTitle),
        ]),
        h("div", { class: "blog-intro-content" }, intro),
      ]),
    ]),
    h("section", { class: "blog-feed", "aria-label": "Стрічка думок" }, [
      h("h2", { class: "blog-feed-heading" }, "Стрічка думок"),
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
  ".blog-intro-disclosure { margin: 0; }",
  ".blog-intro-toggle { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; min-height: 3.5rem; box-sizing: border-box; padding: 0.55rem 3rem; list-style: none; cursor: pointer; color: var(--dark); text-align: center; }",
  ".blog-intro-toggle::-webkit-details-marker { display: none; }",
  ".blog-intro-toggle::marker { content: \"\"; }",
  ".blog-intro-chevron-wrap { position: absolute; left: 0.85rem; top: 50%; display: flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; transform: translateY(-50%); border-radius: 50%; background: var(--lightgray); color: var(--darkgray); transition: background 0.15s ease, color 0.15s ease; }",
  ".blog-intro-toggle:hover .blog-intro-chevron-wrap { background: var(--gray); color: var(--dark); }",
  ".blog-intro-chevron { display: block; flex: none; transition: transform 0.25s ease; }",
  ".blog-intro-disclosure:not([open]) .blog-intro-chevron { transform: rotate(-90deg); }",
  ".blog-intro-title { display: inline-block; max-width: 100%; padding: 0.12em 0.42em; border: 1px solid var(--gray); border-radius: 0.24em; background: transparent; color: var(--dark); font-family: var(--headerFont); font-size: clamp(1.54rem, 2.2vw, 1.98rem); font-weight: 650; line-height: 1.3; }",
  "@media (max-width: 600px) { .blog-intro-toggle { padding-inline: 2.5rem; } .blog-intro-chevron-wrap { left: 0.35rem; } .blog-intro-title { font-size: clamp(1.375rem, 4.95vw, 1.76rem); } }",
  ".blog-intro-content { padding-top: 0.65rem; }",
  ".blog-intro-content > :first-child { margin-top: 0; }",
  ".blog-intro img { max-width: 100%; height: auto; border-radius: 3px; }",
  ".blog-feed-heading { margin: 0 0 1.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--lightgray); font-size: 1.35rem; }",
  ".blog-post-preview { padding: 0 0 2.25rem; margin: 0 0 2.25rem; border-bottom: 1px solid var(--lightgray); }",
  ".blog-post-date { margin: 0 0 0.55rem; color: var(--gray); font-size: 0.88rem; }",
  ".blog-post-title { margin: 0 0 0.9rem; font-size: 1.35rem; line-height: 1.35; }",
  ".blog-post-title a { color: var(--dark) !important; background: transparent !important; box-shadow: none !important; text-decoration: none; }",
  ".blog-post-title a:hover, .blog-read-more:hover { color: var(--secondary); }",
  ".blog-post-excerpt { margin: 0 0 1rem; line-height: 1.75; }",
  ".blog-post-excerpt-text { margin: 0 0 0.65rem; }",
  ".blog-post-excerpt-text:last-child { margin-bottom: 0; }",
  ".blog-post-excerpt-image { display: block; max-width: 100%; max-height: 28rem; width: auto; height: auto; margin: 0 0 0.85rem; border-radius: 3px; }",
  ".blog-post-excerpt-video { display: block; max-width: 100%; max-height: 28rem; width: min(100%, 40rem); height: auto; margin: 0 0 0.85rem; border-radius: 3px; }",
  ".blog-post-excerpt-audio { display: block; max-width: 100%; width: min(100%, 40rem); margin: 0 0 0.85rem; }",
  ".blog-post-excerpt-iframe { display: block; max-width: 100%; width: min(100%, 40rem); height: auto; min-height: 14rem; aspect-ratio: 16 / 9; margin: 0 0 0.85rem; border: 0; border-radius: 3px; }",
  ".blog-post-excerpt-iframe-document { aspect-ratio: 4 / 5; }",
  ".blog-post-excerpt-object, .blog-post-excerpt-embed { display: block; max-width: 100%; width: min(100%, 40rem); min-height: 14rem; margin: 0 0 0.85rem; }",
  ".blog-post-tags { display: flex; flex-wrap: wrap; gap: 0.45rem; margin: 0 0 1rem; }",
  ".blog-tag { display: inline-flex; align-items: center; padding: 0.16rem 0.65rem; border: 0; border-radius: 999px; color: var(--dark) !important; background: var(--lightgray) !important; font-family: var(--bodyFont); font-size: 0.88rem; font-weight: 400; line-height: 1.5; text-decoration: none; transition: background 0.15s ease, color 0.15s ease; }",
  ".blog-tag:hover { color: var(--dark); background: var(--lightgray); }",
  ".blog-read-more { display: inline-block; padding: 0 !important; border: 0 !important; border-radius: 0 !important; color: var(--secondary) !important; background: transparent !important; box-shadow: none !important; font-size: 0.9rem; font-weight: 600; text-decoration: none; }",
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
