export type CaseRemarkEntry = { message: string; timestamp: string | null };

// The append-only storage format is [Indian display timestamp] text, separated
// by blank lines. Preserve multiline bodies and legacy unstructured text.
export function splitCaseRemarkHistory(value: string): CaseRemarkEntry[] {
  const text = value.trim();
  if (!text) return [];
  const marker = /(?:^|\r?\n\r?\n)\[(\d{1,2}\s+[A-Za-z]{3}\s+\d{4},\s*\d{1,2}:\d{2}\s*(?:am|pm))\][ \t]*/gi;
  const matches = Array.from(text.matchAll(marker));
  if (!matches.length) return [{ message: text, timestamp: null }];
  const entries: CaseRemarkEntry[] = [];
  const legacy = text.slice(0, matches[0].index).trim();
  if (legacy) entries.push({ message: legacy, timestamp: null });
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[i + 1]?.index ?? text.length;
    entries.push({ message: text.slice(start, end).trim(), timestamp: match[1] });
  }
  return entries;
}
