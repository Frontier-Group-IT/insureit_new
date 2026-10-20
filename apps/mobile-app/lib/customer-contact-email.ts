/**
 * A Customer's authenticated Supabase Auth email is NOT necessarily a
 * deliverable customer contact email. Firebase SMS-only customers may have a
 * reserved .invalid alias used exclusively for Supabase magiclink sessions.
 * Never copy that internal login identity into Customer master/onboarding.
 */
const internalAuthAlias = /^c-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@customer-login\.insureit\.invalid$/i;

export function customerContactEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (!email || internalAuthAlias.test(email) ||
      email.toLowerCase().endsWith('@customer-login.insureit.invalid')) {
    return null;
  }
  return email;
}
