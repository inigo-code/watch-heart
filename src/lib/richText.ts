// Reviews keep a little formatting, written the way people type it in messages:
//   **bold**, *italic* (or _italic_), a line starting with "> " is a quote, and a blank line starts
//   a new paragraph. Imports convert HTML (Letterboxd's <i>, <b>, <p>, <blockquote>) to the same.

export type Span = { text: string; bold?: boolean; italic?: boolean };
export type Block = { quote: boolean; lines: Span[][] };

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g;

function spans(line: string): Span[] {
  const out: Span[] = [];
  for (const part of line.split(INLINE)) {
    if (!part) continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) out.push({ text: part.slice(2, -2), bold: true });
    else if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      if (part.length > 2) out.push({ text: part.slice(1, -1), italic: true });
      else out.push({ text: part });
    } else out.push({ text: part });
  }
  return out;
}

/** Paragraphs (and quotes) of styled text. */
export function parseRich(text: string): Block[] {
  const blocks: Block[] = [];
  for (const para of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = para.split('\n').filter((l) => l.trim());
    if (!lines.length) continue;
    // A paragraph whose lines all start with ">" is a quote; mixed paragraphs split where it changes.
    let current: Block | null = null;
    for (const raw of lines) {
      const quote = /^\s*>\s?/.test(raw);
      const line = raw.replace(/^\s*>\s?/, '');
      if (!current || current.quote !== quote) {
        current = { quote, lines: [] };
        blocks.push(current);
      }
      current.lines.push(spans(line));
    }
  }
  return blocks;
}

/** The words without the formatting marks, for one-line previews, stories and exports. */
export function plainText(text: string): string {
  return text
    .replace(/^[ \t]*>[ \t]?/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1');
}

const ENTITIES: Record<string, string> = { amp: '&', quot: '"', '#039': "'", apos: "'", lt: '<', gt: '>', nbsp: ' ' };

/** HTML from another app's export (Letterboxd) as the formatting above. */
export function fromHtml(html: string): string {
  return html
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/?p[^>]*>/gi, '\n\n')
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, q: string) =>
      `\n\n${q.trim().split('\n').map((l) => `> ${l.trim()}`).join('\n')}\n\n`,
    )
    .replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|quot|#039|apos|lt|gt|nbsp);/g, (_, e: string) => ENTITIES[e])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The formatting above as HTML, for a Letterboxd import file. */
export function toHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return parseRich(text)
    .map((b) => {
      const body = b.lines
        .map((line) => line.map((s) => (s.bold ? `<b>${esc(s.text)}</b>` : s.italic ? `<i>${esc(s.text)}</i>` : esc(s.text))).join(''))
        .join('<br />');
      return b.quote ? `<blockquote>${body}</blockquote>` : `<p>${body}</p>`;
    })
    .join('');
}

/**
 * Wraps the selected words in a mark (bold "**", italic "*") or makes the selected lines a quote.
 * Returns the new text and where the cursor should go.
 */
export function applyFormat(text: string, sel: { start: number; end: number }, kind: 'bold' | 'italic' | 'quote') {
  if (kind === 'quote') {
    const lineStart = text.lastIndexOf('\n', Math.max(0, sel.start - 1)) + 1;
    const nextBreak = text.indexOf('\n', sel.end);
    const lineEnd = nextBreak === -1 ? text.length : nextBreak;
    const lines = text.slice(lineStart, lineEnd).split('\n');
    const quoted = lines.every((l) => /^>\s?/.test(l));
    const changed = lines.map((l) => (quoted ? l.replace(/^>\s?/, '') : `> ${l}`)).join('\n');
    const next = text.slice(0, lineStart) + changed + text.slice(lineEnd);
    const end = lineStart + changed.length;
    return { text: next, selection: { start: end, end } };
  }
  const mark = kind === 'bold' ? '**' : '*';
  const picked = text.slice(sel.start, sel.end);
  const inner = picked || (kind === 'bold' ? 'bold' : 'italic');
  const next = text.slice(0, sel.start) + mark + inner + mark + text.slice(sel.end);
  const start = sel.start + mark.length;
  return { text: next, selection: { start, end: start + inner.length } };
}
