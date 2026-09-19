/**
 * Trim free text for a social card: whitespace collapsed, cut at a word
 * boundary, an ellipsis when anything was dropped. takumi renders exactly what
 * it is given, so a raw `slice()` shows "…idler gear to 1st moti" on the card.
 */
export function cardExcerpt(text: string | null | undefined, max: number): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  // The cut lands on a word boundary when the next character is a space.
  const atWord = clean[cut.length] === ' ' ? cut.length : cut.lastIndexOf(' ');
  return `${(atWord > max / 2 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}
