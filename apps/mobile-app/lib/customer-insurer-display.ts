/**
 * Customer-facing insurer label only. Never use this for insurer ID, logo matching,
 * search filtering, database writes, policy PDFs, or regulatory/legal names.
 */
export function customerInsurerDisplayName(value?: string | null): string {
  const original = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (!original) return '';

  const shortened = original
    .replace(/\s+(?:(?:company|co\.?)[\s,]*)?(?:(?:private|pvt\.?)\s+)?(?:limited|ltd\.?)\.?$/i, '')
    .replace(/\s+(?:company|co\.?)\.?$/i, '')
    .trim();

  return shortened || original;
}
