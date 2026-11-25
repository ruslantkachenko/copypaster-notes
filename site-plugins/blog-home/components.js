import { h } from "preact";

const INTERNAL_TAGS = new Set(["published", "note"]);

function tagsFor(page) {
  const value = page.frontmatter?.tags ?? [];
  return Array.isArray(value) ? value.map(String) : [];
}

function isPublished(page) {
  return tagsFor(page).some((tag) => tag.toLowerCase() === "published");
}

function hasCreatedDate(page) {
  return Boolean(page.dates?.created ?? page.frontmatter?.created);
}

export function BlogTagFilter() {
  const TagFilter = ({ allFiles }) => {
    const posts = allFiles.filter(
      (page) => page.slug !== "index" && isPublished(page) && hasCreatedDate(page),
    );
    const counts = new Map();

    for (const page of posts) {
      const uniqueTags = new Set(
        tagsFor(page).filter((tag) => !INTERNAL_TAGS.has(tag.toLowerCase())),
      );
      for (const tag of uniqueTags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    const tags = [...counts.entries()].sort(
      ([tagA, countA], [tagB, countB]) =>
        countB - countA || tagA.localeCompare(tagB, "uk-UA"),
    );

    return h("aside", { class: "blog-tag-filter", "aria-label": "Фільтр публікацій за темами" }, [
      h("h3", { class: "blog-tag-filter__title" }, "Теми"),
      h(
        "div",
        { class: "blog-tag-filter__items" },
        [
          h(
            "button",
            {
              type: "button",
              class: "blog-tag-filter__button is-active",
              "data-blog-tag": "__all__",
              "aria-pressed": "true",
            },
            "Усі",
          ),
          ...tags.map(([tag, count]) =>
            h(
              "button",
              {
                type: "button",
                class: "blog-tag-filter__button",
                "data-blog-tag": tag,
                "aria-pressed": "false",
                key: tag,
              },
              [
                h("span", { class: "blog-tag-filter__label" }, tag),
                h("span", { class: "blog-tag-filter__count" }, String(count)),
              ],
            ),
          ),
        ],
      ),
      h(
        "p",
        { class: "blog-tag-filter__status", "aria-live": "polite" },
        "Показано " + posts.length + " з " + posts.length,
      ),
      tags.length
        ? null
        : h("p", { class: "blog-tag-filter__empty" }, "Теги з’являться після публікації дописів."),
    ]);
  };

  TagFilter.css = `
.blog-tag-filter {
  min-width: 0;
  padding-top: 0.4rem;
}
.blog-tag-filter__title {
  margin: 0 0 0.9rem;
  font-size: 1rem;
  font-weight: 600;
}
.blog-tag-filter__items {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.45rem;
}
.blog-tag-filter__button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  max-width: 100%;
  padding: 0.28rem 0.65rem;
  border: 0;
  border-radius: 999px;
  color: var(--darkgray);
  background: var(--highlight);
  font: inherit;
  font-size: 0.8rem;
  line-height: 1.45;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.blog-tag-filter__button:hover {
  color: var(--dark);
  background: var(--lightgray);
}
.blog-tag-filter__button.is-active {
  color: var(--light);
  background: var(--secondary);
}
.blog-tag-filter__count {
  color: inherit;
  opacity: 0.65;
  font-size: 0.72rem;
}
.blog-tag-filter__status {
  margin: 0.9rem 0 0;
  color: var(--gray);
  font-size: 0.78rem;
}
.blog-tag-filter__empty {
  color: var(--gray);
  font-size: 0.85rem;
}
`;

  TagFilter.afterDOMLoaded = `
(() => {
  if (window.__copypasterTagFilterInstalled) return;
  window.__copypasterTagFilterInstalled = true;

  const selected = new Set();

  function applyFilter(root) {
    const cards = [...document.querySelectorAll(".blog-post-preview[data-blog-tags]")];
    let visible = 0;

    for (const card of cards) {
      let tags = [];
      try {
        tags = JSON.parse(card.dataset.blogTags || "[]");
      } catch {
        tags = [];
      }

      const show = [...selected].every((tag) => tags.includes(tag));
      card.hidden = !show;
      if (show) visible += 1;
    }

    root.querySelectorAll("[data-blog-tag]").forEach((button) => {
      const tag = button.dataset.blogTag;
      const active = tag === "__all__" ? selected.size === 0 : selected.has(tag);
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    const status = root.querySelector(".blog-tag-filter__status");
    if (status) status.textContent = "Показано " + visible + " з " + cards.length;

    const empty = document.querySelector(".blog-filter-empty");
    if (empty) empty.hidden = visible !== 0;
  }

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest(".blog-tag-filter [data-blog-tag]");
    if (!button) return;

    const root = button.closest(".blog-tag-filter");
    const tag = button.dataset.blogTag;

    if (tag === "__all__") {
      selected.clear();
    } else if (selected.has(tag)) {
      selected.delete(tag);
    } else {
      selected.add(tag);
    }

    applyFilter(root);
  });
})();
`;

  return TagFilter;
}
