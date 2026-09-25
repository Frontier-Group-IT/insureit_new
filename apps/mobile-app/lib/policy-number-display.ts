export function formatExternalPolicyNumber(value?: string | null) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  return normalized.split('').map((char, index) => index % 2 === 1 ? '•' : char).join('');
}
