import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { CommercialReviewClient, type CommercialReviewRow } from "@/app/policies/commercial-review/commercial-review-client";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PolicyRow = { id: string; policy_no: string; insurance_company_id: string; issuance_date: string | null; start_date: string };
type PremiumRow = { policy_id: string; od_premium: number | null; tp_premium: number | null; cpa_amount: number | null };
type PayinRow = { policy_id: string; projected_od_percent: number | null; projected_tp_percent: number | null; insurer_scheme_amount: number | null; total_projected_payin: number | null };
type PayoutRow = { policy_id: string; od_payout_percent: number | null; tp_payout_percent: number | null; gross_payout: number | null; created_at: string };
type InsurerRow = { id: string; name: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PolicyCommercialReviewPage() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");

  const admin = createSupabaseAdminClient();
  const [policiesResult, premiumResult, payinResult, payoutResult, insurersResult] = await Promise.all([
    admin.from("policies").select("id,policy_no,insurance_company_id,issuance_date,start_date").order("issuance_date", { ascending: false }).returns<PolicyRow[]>(),
    admin.from("policy_premium_details").select("policy_id,od_premium,tp_premium,cpa_amount").returns<PremiumRow[]>(),
    admin.from("policy_payin_details").select("policy_id,projected_od_percent,projected_tp_percent,insurer_scheme_amount,total_projected_payin").returns<PayinRow[]>(),
    admin.from("policy_intermediary_payouts").select("policy_id,od_payout_percent,tp_payout_percent,gross_payout,created_at").order("created_at", { ascending: false }).returns<PayoutRow[]>(),
    admin.from("insurance_companies").select("id,name").returns<InsurerRow[]>(),
  ]);

  const error = policiesResult.error ?? premiumResult.error ?? payinResult.error ?? payoutResult.error ?? insurersResult.error;
  if (error) throw new Error(`Unable to load commercial review: ${error.message}`);

  const premiumByPolicy = new Map((premiumResult.data ?? []).map((row) => [row.policy_id, row]));
  const payinByPolicy = new Map((payinResult.data ?? []).map((row) => [row.policy_id, row]));
  const payoutByPolicy = new Map<string, PayoutRow>();
  for (const row of payoutResult.data ?? []) if (!payoutByPolicy.has(row.policy_id)) payoutByPolicy.set(row.policy_id, row);
  const insurerById = new Map((insurersResult.data ?? []).map((row) => [row.id, row.name]));

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
      payoutOdPercent: Number(payout?.od_payout_percent ?? 0),
      payoutTpPercent: Number(payout?.tp_payout_percent ?? 0),
      payoutTotal: Number(payout?.gross_payout ?? 0),
    };
  });

  const payinReviewCount = rows.filter((row) => row.projectedOdPercent === 0 && row.projectedTpPercent === 0 && row.schemeAmount === 0).length;
  const payoutReviewCount = rows.filter((row) => row.payoutOdPercent === 0 && row.payoutTpPercent === 0).length;

  return (
    <AppShell title="Commercial Control">
      <div className="mx-auto max-w-[1560px] space-y-4 pb-8">
        <section className="rounded-2xl border border-[#D9E2F0] bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[17px] font-semibold text-[#17365D]">Commercial Control</h1>
              <p className="mt-1 max-w-3xl text-[10px] leading-5 text-[#667085]">Maintain historical projected insurer pay-in and actual agreed partner payout terms. This is now an Accounts operation; Phase B will replace this legacy bulk-review surface with a governed commercial control ledger.</p>
            </div>
            <div className="flex gap-2">
              <Metric label="Pay-in review" value={payinReviewCount} />
              <Metric label="Payout review" value={payoutReviewCount} />
            </div>
          </div>
        </section>
        <CommercialReviewClient rows={rows} />
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="min-w-[112px] rounded-xl border border-[#E1E7EF] bg-[#F8FAFC] px-3 py-2.5"><div className="text-[8px] font-bold uppercase tracking-[.055em] text-[#7A8798]">{label}</div><div className="mt-1 text-[18px] font-semibold text-[#17365D]">{new Intl.NumberFormat("en-IN").format(value)}</div></div>;
}
