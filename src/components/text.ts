/** Plain text from the free text people write (descriptions may hold Discord-style markdown). */

/**
 * A description reduced to plain text for a card: links keep their text, the
 * markdown marks go, lines run together. The card then clamps it to a few lines.
 */
export function plainExcerpt(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+])\s+/gm, '')
    .replace(/(\*\*|__|~~|\|\||`+)/g, '')
    .replace(/(^|[\s(])[*_]+|[*_]+(?=[\s).,;:!?]|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}
