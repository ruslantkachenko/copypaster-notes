function getTags(frontmatter) {
  const value = frontmatter?.tags ?? [];
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim().toLowerCase());
  if (typeof value === "string") return [value.trim().toLowerCase()];
  return [];
}

export function markUnpublishedAsUnlisted(file) {
  const data = file?.data;
  if (!data || typeof data !== "object") return file;

  const slug = String(data.slug ?? "").replace(/\\.md$/i, "");
  // The root index is the presentation homepage, not a regular blog post.
  if (slug === "index") return file;

  const frontmatter =
    data.frontmatter && typeof data.frontmatter === "object" ? data.frontmatter : {};
  const tags = getTags(frontmatter);
  const hasPublishedTag = tags.includes("published");

  // Keep explicitly unlisted/encrypted pages hidden too. Otherwise, publishing
  // is controlled by the presence of the "published" tag.
  data.unlisted =
    data.unlisted === true || frontmatter.unlisted === true || !hasPublishedTag;

  return file;
}

export default function PublishedVisibility() {
  return {
    name: "PublishedVisibility",
    htmlPlugins() {
      return [
        () => (_tree, file) => {
          markUnpublishedAsUnlisted(file);
        },
      ];
    },
  };
}
