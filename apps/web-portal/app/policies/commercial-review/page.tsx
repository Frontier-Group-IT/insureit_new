import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { CommercialReviewClient, type CommercialReviewRow } from "@/app/policies/commercial-review/commercial-review-client";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { CommercialStatus } from "./actions";

type PolicyRow = { id: string; policy_no: string; insurance_company_id: string; issuance_date: string | null; start_date: string };
type PremiumRow = { policy_id: string; od_premium: number | null; tp_premium: number | null; cpa_amount: number | null };
type PayinRow = { policy_id: string; projected_od_percent: number | null; projected_tp_percent: number | null; insurer_scheme_amount: number | null; total_projected_payin: number | null; commercial_status: CommercialStatus | null; commercial_note: string | null; commercial_reviewed_at: string | null; updated_at: string | null };
type PayoutRow = { policy_id: string; intermediary_type: string | null; intermediary_code: string | null; od_payout_percent: number | null; tp_payout_percent: number | null; gross_payout: number | null; commercial_status: CommercialStatus | null; commercial_note: string | null; commercial_reviewed_at: string | null; updated_at: string | null; created_at: string };
type InsurerRow = { id: string; name: string };
type EventRow = { policy_id: string; commercial_side: "insurer" | "partner"; action: string; note: string | null; created_at: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PolicyCommercialReviewPage() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");

  const admin = createSupabaseAdminClient();
  const [policiesResult, premiumResult, payinResult, payoutResult, insurersResult, eventsResult] = await Promise.all([
    admin.from("policies").select("id,policy_no,insurance_company_id,issuance_date,start_date").order("issuance_date", { ascending: false }).returns<PolicyRow[]>(),
    admin.from("policy_premium_details").select("policy_id,od_premium,tp_premium,cpa_amount").returns<PremiumRow[]>(),
    admin.from("policy_payin_details").select("policy_id,projected_od_percent,projected_tp_percent,insurer_scheme_amount,total_projected_payin,commercial_status,commercial_note,commercial_reviewed_at,updated_at").returns<PayinRow[]>(),
    admin.from("policy_intermediary_payouts").select("policy_id,intermediary_type,intermediary_code,od_payout_percent,tp_payout_percent,gross_payout,commercial_status,commercial_note,commercial_reviewed_at,updated_at,created_at").order("created_at", { ascending: false }).returns<PayoutRow[]>(),
    admin.from("insurance_companies").select("id,name").returns<InsurerRow[]>(),
    admin.from("commercial_control_events").select("policy_id,commercial_side,action,note,created_at").order("created_at", { ascending: false }).limit(500).returns<EventRow[]>(),
  ]);

  const error = policiesResult.error ?? premiumResult.error ?? payinResult.error ?? payoutResult.error ?? insurersResult.error ?? eventsResult.error;
  if (error) throw new Error(`Unable to load Commercial Control: ${error.message}`);

  const premiumByPolicy = new Map((premiumResult.data ?? []).map((row) => [row.policy_id, row]));
  const payinByPolicy = new Map((payinResult.data ?? []).map((row) => [row.policy_id, row]));
  const payoutByPolicy = new Map<string, PayoutRow>();
  for (const row of payoutResult.data ?? []) if (!payoutByPolicy.has(row.policy_id)) payoutByPolicy.set(row.policy_id, row);
  const insurerById = new Map((insurersResult.data ?? []).map((row) => [row.id, row.name]));
  const lastEventByKey = new Map<string, EventRow>();
  for (const event of eventsResult.data ?? []) {
    const key = `${event.policy_id}:${event.commercial_side}`;
    if (!lastEventByKey.has(key)) lastEventByKey.set(key, event);
  }

  const rows: CommercialReviewRow[] = (policiesResult.data ?? []).map((policy) => {
    const premium = premiumByPolicy.get(policy.id);
    const payin = payinByPolicy.get(policy.id);
    const payout = payoutByPolicy.get(policy.id);
    return {
      id: policy.id,
      policyNo: policy.policy_no,
      insurerName: insurerById.get(policy.insurance_company_id) ?? "Unknown insurer",
      issuanceDate: policy.issuance_date ?? policy.start_date,
      odPremium: Number(premium?.od_premium ?? 0),
      tpCpaPremium: Number(premium?.tp_premium ?? 0) + Number(premium?.cpa_amount ?? 0),
      projectedOdPercent: Number(payin?.projected_od_percent ?? 0),
      projectedTpPercent: Number(payin?.projected_tp_percent ?? 0),
      schemeAmount: Number(payin?.insurer_scheme_amount ?? 0),
      projectedTotal: Number(payin?.total_projected_payin ?? 0),
      insurerStatus: payin?.commercial_status ?? "not_entered",
      insurerNote: payin?.commercial_note ?? "",
      insurerReviewedAt: payin?.commercial_reviewed_at ?? null,
      insurerUpdatedAt: payin?.updated_at ?? null,
      insurerLastAction: lastEventByKey.get(`${policy.id}:insurer`)?.action ?? null,
      insurerLastActionAt: lastEventByKey.get(`${policy.id}:insurer`)?.created_at ?? null,
      payoutOdPercent: Number(payout?.od_payout_percent ?? 0),
      payoutTpPercent: Number(payout?.tp_payout_percent ?? 0),
      payoutTotal: Number(payout?.gross_payout ?? 0),
      partnerStatus: payout?.commercial_status ?? "not_entered",
      partnerNote: payout?.commercial_note ?? "",
      partnerType: payout?.intermediary_type ?? null,
      partnerCode: payout?.intermediary_code ?? null,
      partnerReviewedAt: payout?.commercial_reviewed_at ?? null,
      partnerUpdatedAt: payout?.updated_at ?? null,
      partnerLastAction: lastEventByKey.get(`${policy.id}:partner`)?.action ?? null,
      partnerLastActionAt: lastEventByKey.get(`${policy.id}:partner`)?.created_at ?? null,
    };
  });

  return (
    <AppShell title="Commercial Control">
      <div className="mx-auto max-w-[1720px] space-y-2.5 pb-6">
        <section className="flex items-center justify-between rounded-2xl border border-[#D9E2F0] bg-white px-4 py-2.5 shadow-sm">
          <h1 className="text-[17px] font-semibold text-[#17365D]">Commercial Control</h1>
          <div className="rounded-lg border border-[#DDE6EE] bg-[#F8FAFC] px-2.5 py-1.5 text-[8.5px] font-semibold text-[#526277]">{rows.length.toLocaleString("en-IN")} policies</div>
        </section>
        <CommercialReviewClient rows={rows} />
      </div>
    </AppShell>
  );
}
