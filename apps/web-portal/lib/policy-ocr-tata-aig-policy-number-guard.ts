import type { ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

export function guardTataAigPolicyNumber(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 100).join(" ");
  if (!/TATA\s+AIG\s+GENERAL\s+INSURANCE/i.test(header)) return parsed;

  const fields = new Map(parsed.fields.map((field) => [field.key, field]));

  for (let pageIndex = 0; pageIndex < Math.min(pages.length, 3); pageIndex += 1) {
    const page = pages[pageIndex] ?? "";
    const match = page.match(/Policy\s+No\.?\s*[:\-]?\s*([0-9]{4,}(?:[ \t]+[0-9]{2,4}){1,4})/i);
    if (!match?.[1]) continue;
    const value = match[1].replace(/\s+/g, "");
    if (value.length < 10 || value.length > 24) continue;
    fields.set("policy_number", {
      key: "policy_number",
      label: "Policy number",
      value,
      confidence: .99,
      page: pageIndex + 1,
      evidence: match[0].slice(0, 500),
    });
    break;
  }

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex] ?? "";
    const labelIndex = page.search(/Total\s+IDV/i);
    if (labelIndex < 0) continue;
    const evidence = page.slice(labelIndex, labelIndex + 260);
    const candidates = [...evidence.matchAll(/[0-9][0-9,]*(?:\.[0-9]{1,2})?/g)]
      .map((match) => Number(match[0].replace(/,/g, "")))
      .filter((value) => Number.isFinite(value) && value >= 10000 && value <= 1000000000 && (value < 1900 || value > 2100));
    if (!candidates.length) continue;
    const value = Math.max(...candidates);
    fields.set("idv", {
      key: "idv",
      label: "IDV / Sum insured",
      value: Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""),
      confidence: .99,
      page: pageIndex + 1,
      evidence: evidence.slice(0, 500),
    });
    break;
  }

  return { ...parsed, fields: [...fields.values()] };
}
