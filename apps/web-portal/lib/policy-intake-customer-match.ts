export type PolicyIntakeCustomerIdentityCandidate = {
  id: string;
  contact_name: string;
  company_name: string | null;
};

export function normalizePolicyIntakeCustomerName(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\bm\s*[/.]?\s*s\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function selectPolicyIntakeCustomerMatch(
  candidates: PolicyIntakeCustomerIdentityCandidate[],
  insuredName: string,
) {
  const normalizedInsuredName = normalizePolicyIntakeCustomerName(insuredName);
  if (!normalizedInsuredName) return null;

  const matches = candidates.filter((candidate) => {
    const names = [candidate.company_name, candidate.contact_name]
      .filter((value): value is string => Boolean(value?.trim()))
      .map(normalizePolicyIntakeCustomerName);
    return names.includes(normalizedInsuredName);
  });

  return matches.length === 1 ? matches[0].id : null;
}
