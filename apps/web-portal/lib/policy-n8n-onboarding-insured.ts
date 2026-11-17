/**
 * Explicit operator-reviewed ICICI Product 3005 n8n handoff only.
 *
 * The n8n parser has validated the current private PDF; an insured name may be
 * proposed into the *editable draft* but NEVER used by itself to choose/link a
 * customer master record or to book a policy. The operator must review the
 * original PDF before final submission. No raw text or PII is logged.
 */
type VerifiedIdentityField = {
  key: string;
  value: string;
  evidence?: string;
  page?: number | null;
};

type LinkedCustomer = { id: string; name: string };

export type VerifiedInsuredDraftIdentity = {
  name: string;
  matchedCustomerId: string | null;
  needsManualReview: boolean;
  source: "linked_master" | "verified_pdf" | "conflict" | "missing";
};

function normalizedName(raw: string) {
  return raw.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function sameInsuredIdentity(a: string, b: string) {
  return normalizedName(a).toLocaleUpperCase("en-IN") === normalizedName(b).toLocaleUpperCase("en-IN");
}

export function selectVerifiedN8nInsuredDraftIdentity(
  fields: readonly VerifiedIdentityField[],
  linkedCustomer: LinkedCustomer | null,
): VerifiedInsuredDraftIdentity {
  const source = fields.find(field => field.key === "insured_name"
    && field.page === 1 && /^Name of (?:the )?Insured$/i.test(field.evidence?.trim() ?? ""));
  const candidate = source ? normalizedName(source.value) : "";
  // Fail closed for an empty, placeholder or malformed PDF identity.
  const pdfName = candidate.length >= 2 && candidate.length <= 120
    && /^[\p{L}][\p{L}\p{M} .'-]*$/u.test(candidate)
    && !/^(?:NA|N\/A|NAME|UNKNOWN|INSURED|CUSTOMER)$/i.test(candidate)
    ? candidate : "";

  if (linkedCustomer?.id && normalizedName(linkedCustomer.name)) {
    const masterName = normalizedName(linkedCustomer.name);
    if (pdfName && !sameInsuredIdentity(masterName, pdfName)) {
      // Do not quietly attach a policy to a different existing customer.
      return { name: pdfName, matchedCustomerId: null, needsManualReview: true, source: "conflict" };
    }
    return {
      name: masterName, matchedCustomerId: linkedCustomer.id,
      needsManualReview: false, source: "linked_master",
    };
  }
  if (pdfName) return { name: pdfName, matchedCustomerId: null, needsManualReview: true, source: "verified_pdf" };
  return { name: "", matchedCustomerId: null, needsManualReview: true, source: "missing" };
}
