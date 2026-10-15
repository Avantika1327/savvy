/**
 * Allow-list sanitizer for the limited formatting supported by RichTextEditor.
 * Backend sanitization is also required; this helper protects the browser render path.
 */
const ALLOWED_TAGS = new Set([
  "P", "DIV", "BR", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI",
  "BLOCKQUOTE", "H2", "H3", "PRE", "CODE", "A",
]);
const DROP_WITH_CONTENT = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"]);

function safeHref(value: string): string | null {
  const href = value.trim();
  if (!href) return null;
  try {
    const parsed = new URL(href, window.location.origin);
    if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return null;
    // Only allow relative links or explicit safe URL schemes.
    if (href.startsWith("/") || parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:") {
      return href;
    }
    return null;
  } catch {
    return null;
  }
}

export function sanitizeRichTextHtml(input: string | null | undefined): string {
  if (!input) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    // Server-side fallback: return text only rather than trusting raw HTML.
    return input.replace(/<[^>]*>/g, "");
  }

  const parsed = new DOMParser().parseFromString(input, "text/html");
  const output = document.createElement("div");

  const copySafeNodes = (source: ParentNode, target: Node) => {
    Array.from(source.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        target.appendChild(document.createTextNode(node.textContent ?? ""));
        return;
      }
      if (!(node instanceof Element)) return;
      const tag = node.tagName.toUpperCase();
      if (DROP_WITH_CONTENT.has(tag)) return;
      if (!ALLOWED_TAGS.has(tag)) {
        copySafeNodes(node, target);
        return;
      }

      const safeElement = document.createElement(tag.toLowerCase());
      if (tag === "A") {
        const href = safeHref(node.getAttribute("href") ?? "");
        if (href) {
          safeElement.setAttribute("href", href);
          safeElement.setAttribute("rel", "noopener noreferrer");
          safeElement.setAttribute("target", "_blank");
        }
      }
      copySafeNodes(node, safeElement);
      target.appendChild(safeElement);
    });
  };

  copySafeNodes(parsed.body, output);
  return output.innerHTML;
}
