/** A missing or invalid device history is a silent baseline, not evidence of a new unlock. */
export function reconcileRecognitionHistory(raw: string | null, codes: readonly string[]) {
  const current = [...new Set(codes.filter(Boolean))];
  let parsed: unknown = null;
  try { parsed = raw === null ? null : JSON.parse(raw); } catch { /* treat corrupt history as unknown */ }
  const valid = Array.isArray(parsed) && parsed.every(code => typeof code === 'string');
  const known = new Set<string>(valid ? parsed as string[] : []);
  const newlyUnlocked = valid ? current.filter(code => !known.has(code)) : [];
  return {
    newlyUnlocked,
    persisted: JSON.stringify([...new Set([...known, ...current])]),
    shouldWrite: !valid || newlyUnlocked.length > 0,
  };
}
