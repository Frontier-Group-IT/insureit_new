import type { ParsedPolicyResult } from "@/lib/policy-ocr-parsers";

export function guardTataAigPolicyNumber(pages: string[], parsed: ParsedPolicyResult): ParsedPolicyResult {
  const header = (pages[0] ?? "").split(/\r?\n/).slice(0, 100).join(" ");
  if (!/TATA\s+AIG\s+GENERAL\s+INSURANCE/i.test(header)) return parsed;

  for (let pageIndex = 0; pageIndex < Math.min(pages.length, 3); pageIndex += 1) {
    const page = pages[pageIndex] ?? "";
    const match = page.match(/Policy\s+No\.?\s*[:\-]?\s*([0-9]{4,}(?:[ \t]+[0-9]{2,4}){1,4})/i);
    if (!match?.[1]) continue;
    const value = match[1].replace(/\s+/g, "");
    if (value.length < 10 || value.length > 24) continue;

    const fields = parsed.fields.filter((field) => field.key !== "policy_number");
    fields.push({
      key: "policy_number",
      label: "Policy number",
      value,
      confidence: .99,
      page: pageIndex + 1,
      evidence: match[0].slice(0, 500),
    });
    return { ...parsed, fields };
  }

  return parsed;
}
