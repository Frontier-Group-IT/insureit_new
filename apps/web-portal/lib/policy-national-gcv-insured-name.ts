/**
 * National GCV already-issued PDF: the bilingual /Customer Name cell can be
 * emitted by the native text parser with a single stray leading full stop.
 * Normalize only that specific punctuation artifact. Never remove words,
 * initials, M/S, company suffixes, or interior punctuation.
 *
 * The raw value stays on the source-field evidence and the PDF stays attached.
 * Duplicate and customer linking still require EXACT normalized name + phone.
 */
export function normalizeNationalGcvLeadingDot(value:string):{name:string;raw:string}|null{
  const raw=value.normalize("NFKC").trim();
  if(!/^\.[A-Z][A-Z0-9 &'().,\/-]{3,119}$/i.test(raw)
    ||raw.startsWith(".."))return null;
  const name=raw.slice(1);
  if(name.length<4||name.startsWith("."))return null;
  return {name,raw};
}
