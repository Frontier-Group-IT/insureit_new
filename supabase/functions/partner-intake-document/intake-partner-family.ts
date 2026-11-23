// Pure verification of canonical RM/Manager Partner + Branch-family scope.
// Inputs must originate from server-side linked tables, never request JSON.
// Mirrors rm-policy-intake-scope source identifiers and legacy PT aliases.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeCode = /^[A-Z0-9_-]{1,60}$/;
export type FamilyPartner = { id: string; partner_code: string | null };
export function partnerFamilyPredicates(
  parents: readonly FamilyPartner[],
  branches: readonly FamilyPartner[],
  identities: readonly { profile_id: string | null }[],
  intermediaries: readonly { id: string }[],
  accounts: readonly { id: string }[],
): string[] {
  const family = [...parents, ...branches];
  for (const partner of family) {
    if (!uuid.test(partner.id)) throw new Error("Invalid Partner family identifier");
    if (partner.partner_code && !safeCode.test(partner.partner_code.trim()))
      throw new Error("Invalid Partner family code");
  }
  const codes = [...new Set(family.map(p => p.partner_code?.trim()).filter((x): x is string => Boolean(x)))];
  const sourceCodes = [...new Set(codes.flatMap(code => {
    const match = /^PT(\d{5})$/.exec(code);
    return match ? [code, `PART-2026-${match[1]}`] : [code];
  }))];
  const profileIds = [...new Set(identities.map(x => x.profile_id).filter((v): v is string => Boolean(v)))];
  const intermediaryIds = [...new Set(intermediaries.map(x => x.id))];
  const accountIds = [...new Set(accounts.map(x => x.id))];
  for (const id of [...profileIds, ...intermediaryIds, ...accountIds])
    if (!uuid.test(id)) throw new Error("Invalid Partner family linked identity");
  const predicates: string[] = [];
  if (sourceCodes.length) predicates.push(`lead_source_code.in.(${sourceCodes.join(",")})`);
  if (profileIds.length) predicates.push(`submitted_by_profile_id.in.(${profileIds.join(",")})`);
  if (intermediaryIds.length) predicates.push(`lead_source_id.in.(${intermediaryIds.join(",")})`);
  if (accountIds.length) predicates.push(`submitted_by_portal_account_id.in.(${accountIds.join(",")})`);
  return predicates;
}
