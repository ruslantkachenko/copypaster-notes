import { h } from "preact";
import { htmlToJsx } from "@quartz-community/utils/jsx";
import { resolveRelative, slugTag } from "@quartz-community/utils/path";

const INTERNAL_TAGS = new Set(["published", "note"]);

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
      .replace(/[>*_~`]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const candidates = [clean(page.description), clean(page.text)].filter((text) =>
    /[\p{L}\p{N}]/u.test(text),
  );
  const text = candidates.sort((a, b) => b.length - a.length)[0] ?? "";
  if (!text) return "";
  return text.length > 320 ? text.slice(0, 317).trimEnd() + "…" : text;
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
    // Newest first; editing a post does not change its created date.
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const cards = posts.map(({ page, date }) => {
    const title = page.frontmatter?.title ?? "Без назви";
    const href = resolveRelative(fileData.slug, page.slug);
    const tags = pageTags(page).filter((tag) => !INTERNAL_TAGS.has(tag.toLowerCase()));
    const excerpt = plainExcerpt(page);

    return h(
      "article",
      { class: "blog-post-preview", "data-blog-tags": JSON.stringify(tags), key: page.slug },
      [
        h("p", { class: "blog-post-date" }, formatDate(date, cfg.locale)),
        h("h2", { class: "blog-post-title" }, h("a", { href, class: "internal" }, title)),
        excerpt ? h("p", { class: "blog-post-excerpt" }, excerpt) : null,
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

BlogHomeBody.css = `
.blog-home {
  width: 100%;
}
.blog-intro {
  margin-bottom: 3rem;
}
.blog-intro > :first-child {
  margin-top: 0;
}
.blog-intro img {
  max-width: 100%;
  height: auto;
  border-radius: 3px;
}
.blog-feed-heading {
  margin: 0 0 1.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--lightgray);
  font-size: 1.35rem;
}
.blog-post-preview {
  padding: 0 0 2.25rem;
  margin: 0 0 2.25rem;
  border-bottom: 1px solid var(--lightgray);
}
.blog-post-date {
  margin: 0 0 0.55rem;
  color: var(--gray);
  font-size: 0.88rem;
}
.blog-post-title {
  margin: 0 0 0.9rem;
  font-size: 1.35rem;
  line-height: 1.35;
}
.blog-post-title a {
  color: var(--dark);
  text-decoration: none;
}
.blog-post-title a:hover,
.blog-read-more:hover {
  color: var(--secondary);
}
.blog-post-excerpt {
  margin: 0 0 1rem;
  line-height: 1.75;
}
.blog-post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin: 0 0 1rem;
}
.blog-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.7rem;
  border: 0;
  border-radius: 999px;
  color: var(--darkgray);
  background: var(--highlight);
  font-size: 0.78rem;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}
.blog-tag:hover {
  color: var(--dark);
  background: var(--lightgray);
}
.blog-read-more {
  display: inline-block;
  color: var(--secondary);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
}
.blog-feed-empty {
  color: var(--gray);
  font-style: italic;
}
`;

export default function BlogHomePageType() {
  return {
    name: "BlogHomePage",
    priority: 100,
    match: ({ slug }) => slug === "index",
    layout: "blog-home",
    body: () => BlogHomeBody,
  };
}
