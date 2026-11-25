const PREVIEW_MARKER = /^\\s*<!--\\s*more\\s*-->\\s*$/i;
export const PREVIEW_BOUNDARY_TOKEN = "COPypasterManualPreviewBoundary9F61D2";

function markPreviewBoundary(source) {
  const parts = String(source ?? "").split(/(\\r?\\n)/);
  let fenceCharacter = null;
  let fenceLength = 0;

  for (let i = 0; i < parts.length; i += 2) {
    const line = parts[i];
    const fence = line.match(/^\\s*(`{3,}|~{3,})/);

    if (fence) {
      const marker = fence[1];
      if (fenceCharacter === null) {
        fenceCharacter = marker[0];
        fenceLength = marker.length;
      } else if (marker[0] === fenceCharacter && marker.length >= fenceLength) {
        fenceCharacter = null;
        fenceLength = 0;
      }
      continue;
    }

    if (fenceCharacter === null && PREVIEW_MARKER.test(line)) {
      parts[i] = PREVIEW_BOUNDARY_TOKEN;
    }
  }

  return parts.join("");
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
