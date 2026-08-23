"use server";

import { revalidatePath } from "next/cache";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type CommercialSide = "insurer" | "partner";
export type CommercialStatus = "needs_review" | "entered" | "reviewed" | "not_applicable";

type BulkCommercialInput = {
  policyIds: string[];
  side: CommercialSide;
  odPercent?: string;
  tpPercent?: string;
  schemeAmount?: string;
  status?: CommercialStatus;
  note?: string;
};

type PremiumRow = { policy_id: string; od_premium: number | null; tp_premium: number | null; cpa_amount: number | null };
type PayinRow = {
  id: string;
  policy_id: string;
  payout_basis: string | null;
  projected_od_percent: number | null;
  projected_tp_percent: number | null;
  insurer_scheme_amount: number | null;
  total_projected_payin: number | null;
  commercial_status: CommercialStatus | null;
  commercial_note: string | null;
};
type PayoutRow = {
  id: string;
  policy_id: string;
  od_payout_percent: number | null;
  tp_payout_percent: number | null;
  gross_payout: number | null;
  commercial_status: CommercialStatus | null;
  commercial_note: string | null;
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

function eventAction(status: CommercialStatus | undefined, hasValues: boolean) {
  if (status === "not_applicable") return "marked_not_applicable" as const;
  if (status === "reviewed") return "reviewed" as const;
  if (status && !hasValues) return "status_changed" as const;
  return "values_updated" as const;
}

export async function bulkSavePolicyCommercials(input: BulkCommercialInput) {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) return { ok: false as const, error: "Commercial details restricted" };

  const policyIds = Array.from(new Set(input.policyIds.filter(Boolean)));
  if (!policyIds.length) return { ok: false as const, error: "Select at least one policy." };
  if (policyIds.length > 500) return { ok: false as const, error: "Update a maximum of 500 policies at a time." };

  let odPercent: number | null;
  let tpPercent: number | null;
  let schemeAmount: number | null;
  try {
    odPercent = optionalPercent(input.odPercent);
    tpPercent = optionalPercent(input.tpPercent);
    schemeAmount = optionalAmount(input.schemeAmount);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Invalid commercial values." };
  }

  const note = input.note?.trim() || null;
  const hasValues = odPercent !== null || tpPercent !== null || (input.side === "insurer" && schemeAmount !== null);
  if (!hasValues && !input.status && note === null) return { ok: false as const, error: "Enter a value, note, or status to update." };

  const admin = createSupabaseAdminClient();
  const [premiumResult, payinResult, payoutResult] = await Promise.all([
    admin.from("policy_premium_details").select("policy_id,od_premium,tp_premium,cpa_amount").in("policy_id", policyIds).returns<PremiumRow[]>(),
    admin.from("policy_payin_details").select("id,policy_id,payout_basis,projected_od_percent,projected_tp_percent,insurer_scheme_amount,total_projected_payin,commercial_status,commercial_note").in("policy_id", policyIds).returns<PayinRow[]>(),
    admin.from("policy_intermediary_payouts").select("id,policy_id,od_payout_percent,tp_payout_percent,gross_payout,commercial_status,commercial_note").in("policy_id", policyIds).order("created_at", { ascending: false }).returns<PayoutRow[]>(),
  ]);

  const loadError = premiumResult.error ?? payinResult.error ?? payoutResult.error;
  if (loadError) return { ok: false as const, error: loadError.message };

  const premiumByPolicy = new Map((premiumResult.data ?? []).map((row) => [row.policy_id, row]));
  const payinByPolicy = new Map((payinResult.data ?? []).map((row) => [row.policy_id, row]));
  const payoutByPolicy = new Map<string, PayoutRow>();
  for (const row of payoutResult.data ?? []) if (!payoutByPolicy.has(row.policy_id)) payoutByPolicy.set(row.policy_id, row);

  let updated = 0;
  for (const policyId of policyIds) {
    const premium = premiumByPolicy.get(policyId);
    if (!premium) continue;
    const odPremium = Number(premium.od_premium ?? 0);
    const tpCpaPremium = Number(premium.tp_premium ?? 0) + Number(premium.cpa_amount ?? 0);
    const reviewedAt = input.status === "reviewed" ? new Date().toISOString() : null;
    const reviewedBy = input.status === "reviewed" ? String(profile.id) : null;

    if (input.side === "insurer") {
      const current = payinByPolicy.get(policyId);
      const nextOd = input.status === "not_applicable" ? 0 : odPercent ?? Number(current?.projected_od_percent ?? 0);
      const nextTp = input.status === "not_applicable" ? 0 : tpPercent ?? Number(current?.projected_tp_percent ?? 0);
      const nextScheme = input.status === "not_applicable" ? 0 : schemeAmount ?? Number(current?.insurer_scheme_amount ?? 0);
      const projectedOdAmount = odPremium * nextOd / 100;
      const projectedTpAmount = tpCpaPremium * nextTp / 100;
      const totalProjectedPayin = projectedOdAmount + projectedTpAmount + nextScheme;
      const nextStatus: CommercialStatus = input.status ?? (hasValues ? "entered" : current?.commercial_status ?? "needs_review");
      const values = {
        payout_basis: current?.payout_basis ?? "NET",
        projected_od_percent: nextOd,
        projected_od_amount: projectedOdAmount,
        projected_tp_percent: nextTp,
        projected_tp_amount: projectedTpAmount,
        insurer_scheme_amount: nextScheme,
        total_projected_payin: totalProjectedPayin,
        commercial_status: nextStatus,
        commercial_note: note ?? current?.commercial_note ?? null,
        commercial_reviewed_at: nextStatus === "reviewed" ? reviewedAt : null,
        commercial_reviewed_by: nextStatus === "reviewed" ? reviewedBy : null,
        calculation_version: "commercial_control_v2",
        updated_at: new Date().toISOString(),
      };
      const result = current
        ? await admin.from("policy_payin_details").update(values).eq("id", current.id)
        : await admin.from("policy_payin_details").insert({ policy_id: policyId, ...values });
      if (result.error) return { ok: false as const, error: result.error.message };

      const event = await admin.from("commercial_control_events").insert({
        policy_id: policyId,
        commercial_side: "insurer",
        action: eventAction(input.status, hasValues),
        previous_values: current ?? {},
        new_values: values,
        note,
        actor_profile_id: String(profile.id),
      });
      if (event.error) return { ok: false as const, error: event.error.message };
    } else {
      const current = payoutByPolicy.get(policyId);
      const nextOd = input.status === "not_applicable" ? 0 : odPercent ?? Number(current?.od_payout_percent ?? 0);
      const nextTp = input.status === "not_applicable" ? 0 : tpPercent ?? Number(current?.tp_payout_percent ?? 0);
      const odAmount = odPremium * nextOd / 100;
      const tpAmount = tpCpaPremium * nextTp / 100;
      const grossPayout = odAmount + tpAmount;
      const nextStatus: CommercialStatus = input.status ?? (hasValues ? "entered" : current?.commercial_status ?? "needs_review");
      const values = {
        od_payout_percent: nextOd,
        od_payout_amount: odAmount,
        tp_payout_percent: nextTp,
        tp_payout_amount: tpAmount,
        gross_payout: grossPayout,
        commercial_status: nextStatus,
        commercial_note: note ?? current?.commercial_note ?? null,
        commercial_reviewed_at: nextStatus === "reviewed" ? reviewedAt : null,
        commercial_reviewed_by: nextStatus === "reviewed" ? reviewedBy : null,
        calculation_version: "commercial_control_v2",
        updated_at: new Date().toISOString(),
      };
      const result = current
        ? await admin.from("policy_intermediary_payouts").update(values).eq("id", current.id)
        : await admin.from("policy_intermediary_payouts").insert({ policy_id: policyId, retention_amount: 0, status: "Pending", ...values });
      if (result.error) return { ok: false as const, error: result.error.message };

      const event = await admin.from("commercial_control_events").insert({
        policy_id: policyId,
        commercial_side: "partner",
        action: eventAction(input.status, hasValues),
        previous_values: current ?? {},
        new_values: values,
        note,
        actor_profile_id: String(profile.id),
      });
      if (event.error) return { ok: false as const, error: event.error.message };
    }
    updated += 1;
  }

  revalidatePath("/accounts");
  revalidatePath("/policies/commercial-review");
  revalidatePath("/reports/finance");
  return { ok: true as const, updated };
}
