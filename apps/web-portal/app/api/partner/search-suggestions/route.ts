import { NextResponse } from "next/server";
import {
  getPartnerWebPayoutSummary,
  listPartnerWebClaims,
  listPartnerWebCustomers,
  listPartnerWebPolicies,
  listPartnerWebRenewals,
} from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Suggestion = {
  value: string;
  label: string;
  meta: string;
  kind: string;
};

const MAX_SUGGESTIONS = 8;

function compact(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part?.trim())).join(" · ");
}

function dedupe(items: Suggestion[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.value.toLowerCase()}:${item.meta.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_SUGGESTIONS);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope")?.trim().toLowerCase() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) return NextResponse.json({ ok: true, suggestions: [] });

  try {
    let suggestions: Suggestion[] = [];

    if (scope === "customers") {
      const rows = await listPartnerWebCustomers({ search: q, limit: MAX_SUGGESTIONS, offset: 0 });
      suggestions = rows.map((row) => ({
        value: row.customer_name,
        label: row.customer_name,
        meta: compact([row.customer_code, row.company_name, row.phone, row.city]),
        kind: "Customer",
      }));
    } else if (scope === "policies") {
      const rows = await listPartnerWebPolicies({ search: q, limit: MAX_SUGGESTIONS, offset: 0, lifecycle: "all" });
      suggestions = rows.map((row) => ({
        value: row.policy_no || row.policy_code || row.customer_name,
        label: row.policy_no || row.policy_code || "Policy",
        meta: compact([row.customer_name, row.vehicle_no, row.insurer_name]),
        kind: "Policy",
      }));
    } else if (scope === "renewals") {
      const [dueRows, expiredRows] = await Promise.all([
        listPartnerWebRenewals({ search: q, limit: 6, offset: 0, mode: "due", window: "all" }),
        listPartnerWebRenewals({ search: q, limit: 6, offset: 0, mode: "expired", window: "all" }),
      ]);
      suggestions = [...dueRows, ...expiredRows].map((row) => ({
        value: row.policy_no || row.policy_code || row.customer_name,
        label: row.policy_no || row.policy_code || row.customer_name,
        meta: compact([row.customer_name, row.vehicle_no, row.insurer_name]),
        kind: "Renewal",
      }));
    } else if (scope === "claims") {
      const rows = await listPartnerWebClaims({ search: q, limit: MAX_SUGGESTIONS, offset: 0, state: "all" });
      suggestions = rows.map((row) => ({
        value: row.claim_no || row.insurer_claim_no || row.customer_name,
        label: row.claim_no || row.insurer_claim_no || "Claim",
        meta: compact([row.customer_name, row.vehicle_no, row.policy_no, row.insurer_name]),
        kind: "Claim",
      }));
    } else if (scope === "payout") {
      const payout = await getPartnerWebPayoutSummary();
      if (payout.available) {
        const normalized = q.toLowerCase();
        suggestions = payout.recent
          .filter((row) => [
            row.policy_no,
            row.customer_name,
            row.status,
            row.commercial_status,
            row.voucher_number,
            String(row.amount ?? ""),
          ].some((value) => value?.toLowerCase().includes(normalized)))
          .slice(0, MAX_SUGGESTIONS)
          .map((row) => ({
            value: row.policy_no || row.customer_name,
            label: row.policy_no || row.customer_name,
            meta: compact([row.customer_name, row.status, row.voucher_number]),
            kind: "Payout",
          }));
      }
    } else if (scope === "global") {
      const [customers, policies, claims] = await Promise.all([
        listPartnerWebCustomers({ search: q, limit: 4, offset: 0 }),
        listPartnerWebPolicies({ search: q, limit: 4, offset: 0, lifecycle: "all" }),
        listPartnerWebClaims({ search: q, limit: 4, offset: 0, state: "all" }),
      ]);
      suggestions = [
        ...customers.map((row) => ({
          value: row.customer_name,
          label: row.customer_name,
          meta: compact([row.customer_code, row.phone, row.city]),
          kind: "Customer",
        })),
        ...policies.map((row) => ({
          value: row.policy_no || row.policy_code || row.customer_name,
          label: row.policy_no || row.policy_code || "Policy",
          meta: compact([row.customer_name, row.vehicle_no, row.insurer_name]),
          kind: "Policy",
        })),
        ...claims.map((row) => ({
          value: row.claim_no || row.insurer_claim_no || row.customer_name,
          label: row.claim_no || row.insurer_claim_no || "Claim",
          meta: compact([row.customer_name, row.vehicle_no, row.policy_no]),
          kind: "Claim",
        })),
      ];
    } else {
      return NextResponse.json({ ok: false, error: "Unsupported search scope." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, suggestions: dedupe(suggestions) });
  } catch {
    return NextResponse.json({ ok: false, error: "Search suggestions could not be loaded." }, { status: 500 });
  }
}
