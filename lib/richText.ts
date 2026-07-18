import { Document } from "@contentful/rich-text-types";

/**
 * Flatten a Contentful rich-text Document to plain text (no dep on a
 * plain-text renderer). Walks the node tree and concatenates every text value.
 */
export function documentToPlainText(doc?: Document | null): string {
  if (!doc) return "";
  const walk = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    const n = node as { value?: unknown; content?: unknown };
    if (typeof n.value === "string") return n.value;
    if (Array.isArray(n.content)) return n.content.map(walk).join("");
    return "";
  };
  return walk(doc).replace(/\s+/g, " ").trim();
}

/** First sentence of a plain-text string — up to (and including) the first
 *  sentence-ending mark. Falls back to the whole string when none is found. */
export function firstSentence(text: string): string {
  const m = text.match(/^[\s\S]*?[.!?](?=\s|$)/);
  return (m ? m[0] : text).trim();
}
