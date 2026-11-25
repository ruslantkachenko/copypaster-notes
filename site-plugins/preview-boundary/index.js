const PREVIEW_MARKER = "<!-- more -->";
export const PREVIEW_BOUNDARY_TOKEN = "COPypasterManualPreviewBoundary9F61D2";

function markPreviewBoundary(source) {
  const lines = String(source ?? "").split("\n");
  let fenceCharacter = null;
  let fenceLength = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    const first = line.trimStart();
    const markerCharacter = first[0];
    let markerLength = 0;

    if (markerCharacter === "`" || markerCharacter === "~") {
      while (first[markerLength] === markerCharacter) markerLength += 1;
    }

    if (markerLength >= 3) {
      if (fenceCharacter === null) {
        fenceCharacter = markerCharacter;
        fenceLength = markerLength;
      } else if (markerCharacter === fenceCharacter && markerLength >= fenceLength) {
        fenceCharacter = null;
        fenceLength = 0;
      }
      continue;
    }

    if (fenceCharacter === null && trimmed.toLowerCase() === PREVIEW_MARKER) {
      lines[i] = line.replace(trimmed, PREVIEW_BOUNDARY_TOKEN);
    }
  }

  return lines.join("\n");
}

export function removePreviewBoundary(node) {
  if (!node || typeof node !== "object" || !Array.isArray(node.children)) return;

  node.children = node.children.filter((child) => {
    if (child?.type === "text" && typeof child.value === "string") {
      child.value = child.value.split(PREVIEW_BOUNDARY_TOKEN).join("");
      return child.value.length > 0;
    }

    removePreviewBoundary(child);
    return true;
  });
}

export default function PreviewBoundary() {
  return {
    name: "CopypasterPreviewBoundary",
    textTransform(_ctx, source) {
      return markPreviewBoundary(source);
    },
    htmlPlugins() {
      return [
        () => (tree) => {
          // Description (order 70) has already copied the marker into file.data.text.
          // Remove it from the visible article tree so readers never see the marker.
          removePreviewBoundary(tree);
        },
      ];
    },
  };
}

export { markPreviewBoundary };
