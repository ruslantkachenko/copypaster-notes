function normalizePrefix(value) {
  return String(value ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

function rewriteEmbedTargets(source, prefix) {
  if (!prefix) return source;

  const prefixWithSlash = prefix + "/";

  return source.replace(/!\[\[([^\]]+)\]\]/g, (original, target) => {
    // Keep an optional Obsidian alias or heading reference untouched.
    const delimiterIndex = target.search(/[|#]/);
    const targetPath = delimiterIndex === -1 ? target : target.slice(0, delimiterIndex);

    if (!targetPath.startsWith(prefixWithSlash)) {
      return original;
    }

    const suffix = target.slice(targetPath.length);
    return `![[${targetPath.slice(prefixWithSlash.length)}${suffix}]]`;
  });
}

function rewriteMarkdown(source, prefix) {
  if (!prefix) return source;

  const parts = source.split(/(\r?\n)/);
  let fenceCharacter = null;
  let fenceLength = 0;

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i];
    const fence = line.match(/^\s*(`{3,}|~{3,})/);

    if (fence) {
      const marker = fence[1];
      const character = marker[0];

      if (fenceCharacter === null) {
        fenceCharacter = character;
        fenceLength = marker.length;
      } else if (character === fenceCharacter && marker.length >= fenceLength) {
        fenceCharacter = null;
        fenceLength = 0;
      }
      continue;
    }

    if (fenceCharacter !== null) continue;

    // Avoid changing examples inside inline code spans.
    const segments = line.split(/(`+[^\`]*`+)/g);
    parts[i] = segments
      .map((segment, index) =>
        index % 2 === 0 ? rewriteEmbedTargets(segment, prefix) : segment,
      )
      .join("");
  }

  return parts.join("");
}

export default function PublishPathFix(options = {}) {
  const sourcePrefix = normalizePrefix(options.sourcePrefix);

  return {
    name: "CopypasterPublishPathFix",
    textTransform(_ctx, source) {
      return rewriteMarkdown(source, sourcePrefix);
    },
  };
}
