"use server";

import { revalidatePath } from "next/cache";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type BulkCommercialInput = {
  policyIds: string[];
  projectedOdPercent?: string;
  projectedTpPercent?: string;
  schemeAmount?: string;
  payoutOdPercent?: string;
  payoutTpPercent?: string;
};

type PremiumRow = {
  policy_id: string;
  od_premium: number | null;
  tp_premium: number | null;
  cpa_amount: number | null;
};

type PayinRow = {
  id: string;
  policy_id: string;
  payout_basis: string | null;
  projected_od_percent: number | null;
  projected_tp_percent: number | null;
  insurer_scheme_amount: number | null;
};

type PayoutRow = {
  id: string;
  policy_id: string;
  od_payout_percent: number | null;
  tp_payout_percent: number | null;
};

function optionalPercent(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) throw new Error("Percentage values must be between 0 and 100.");
  return parsed;
}

function optionalAmount(value: string | undefined) {
  if (value === undefined || value.trim() === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Scheme amount must be zero or greater.");
  return parsed;
}

export async function bulkSavePolicyCommercials(input: BulkCommercialInput) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) return { ok: false as const, error: "Commercial details restricted" };

  const policyIds = Array.from(new Set(input.policyIds.filter(Boolean)));
  if (!policyIds.length) return { ok: false as const, error: "Select at least one policy." };
  if (policyIds.length > 500) return { ok: false as const, error: "Update a maximum of 500 policies at a time." };

  let projectedOdPercent: number | null;
  let projectedTpPercent: number | null;
  let schemeAmount: number | null;
  let payoutOdPercent: number | null;
  let payoutTpPercent: number | null;
  try {
    projectedOdPercent = optionalPercent(input.projectedOdPercent);
    projectedTpPercent = optionalPercent(input.projectedTpPercent);
    schemeAmount = optionalAmount(input.schemeAmount);
    payoutOdPercent = optionalPercent(input.payoutOdPercent);
    payoutTpPercent = optionalPercent(input.payoutTpPercent);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Invalid commercial values." };
  }

  const hasPayinChange = projectedOdPercent !== null || projectedTpPercent !== null || schemeAmount !== null;
  const hasPayoutChange = payoutOdPercent !== null || payoutTpPercent !== null;
  if (!hasPayinChange && !hasPayoutChange) return { ok: false as const, error: "Enter at least one value to update." };

  const admin = createSupabaseAdminClient();
  const [premiumResult, payinResult, payoutResult] = await Promise.all([
    admin.from("policy_premium_details").select("policy_id,od_premium,tp_premium,cpa_amount").in("policy_id", policyIds).returns<PremiumRow[]>(),
    admin.from("policy_payin_details").select("id,policy_id,payout_basis,projected_od_percent,projected_tp_percent,insurer_scheme_amount").in("policy_id", policyIds).returns<PayinRow[]>(),
    admin.from("policy_intermediary_payouts").select("id,policy_id,od_payout_percent,tp_payout_percent").in("policy_id", policyIds).order("created_at", { ascending: false }).returns<PayoutRow[]>(),
  ]);

  if (premiumResult.error || payinResult.error || payoutResult.error) {
    const error = premiumResult.error ?? payinResult.error ?? payoutResult.error;
    return { ok: false as const, error: error?.message ?? "Unable to load policy commercials." };
  }

  const premiumByPolicy = new Map((premiumResult.data ?? []).map((row) => [row.policy_id, row]));
  const payinByPolicy = new Map((payinResult.data ?? []).map((row) => [row.policy_id, row]));
  const payoutByPolicy = new Map<string, PayoutRow>();
  for (const row of payoutResult.data ?? []) if (!payoutByPolicy.has(row.policy_id)) payoutByPolicy.set(row.policy_id, row);

  let updated = 0;
  for (const policyId of policyIds) {
    const premium = premiumByPolicy.get(policyId);
    if (!premium) continue;
    const od = Number(premium.od_premium ?? 0);
    const tpCpa = Number(premium.tp_premium ?? 0) + Number(premium.cpa_amount ?? 0);

    if (hasPayinChange) {
      const current = payinByPolicy.get(policyId);
      const odPercent = projectedOdPercent ?? Number(current?.projected_od_percent ?? 0);
      const tpPercent = projectedTpPercent ?? Number(current?.projected_tp_percent ?? 0);
      const scheme = schemeAmount ?? Number(current?.insurer_scheme_amount ?? 0);
      const projectedOdAmount = od * odPercent / 100;
      const projectedTpAmount = tpCpa * tpPercent / 100;
      const totalProjectedPayin = projectedOdAmount + projectedTpAmount + scheme;
      const tdsPercent = 10;
      const tdsAmount = totalProjectedPayin * tdsPercent / 100;
      const values = {
        payout_basis: current?.payout_basis ?? "NET",
        projected_od_percent: odPercent,
        projected_od_amount: projectedOdAmount,
        projected_tp_percent: tpPercent,
        projected_tp_amount: projectedTpAmount,
        insurer_scheme_amount: scheme,
        total_projected_payin: totalProjectedPayin,
        tds_percent: tdsPercent,
        tds_amount: tdsAmount,
        payin_after_tds: totalProjectedPayin - tdsAmount,
        calculation_version: "commercial_review_v1",
        updated_at: new Date().toISOString(),
      };
      const result = current
        ? await admin.from("policy_payin_details").update(values).eq("id", current.id)
        : await admin.from("policy_payin_details").insert({ policy_id: policyId, ...values });
      if (result.error) return { ok: false as const, error: result.error.message };
    }

    if (hasPayoutChange) {
      const current = payoutByPolicy.get(policyId);
      const odPercent = payoutOdPercent ?? Number(current?.od_payout_percent ?? 0);
      const tpPercent = payoutTpPercent ?? Number(current?.tp_payout_percent ?? 0);
      const odAmount = od * odPercent / 100;
      const tpAmount = tpCpa * tpPercent / 100;
      const values = {
        od_payout_percent: odPercent,
        od_payout_amount: odAmount,
        tp_payout_percent: tpPercent,
        tp_payout_amount: tpAmount,
        gross_payout: odAmount + tpAmount,
        calculation_version: "commercial_review_v1",
        updated_at: new Date().toISOString(),
      };
      const result = current
        ? await admin.from("policy_intermediary_payouts").update(values).eq("id", current.id)
        : await admin.from("policy_intermediary_payouts").insert({ policy_id: policyId, retention_amount: 0, status: "Pending", ...values });
      if (result.error) return { ok: false as const, error: result.error.message };
    }

    updated += 1;
  }

  revalidatePath("/accounts");
  revalidatePath("/policies/commercial-review");
  revalidatePath("/reports");
  revalidatePath("/reports/finance");
  return { ok: true as const, updated };
}
