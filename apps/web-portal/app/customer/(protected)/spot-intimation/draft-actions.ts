"use server";

import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";
import { createCustomerServerSupabaseClient } from "@/lib/auth-server";

const fieldLimits = {
  accidentDate: 10,
  accidentTime: 5,
  spotDate: 10,
  spotTime: 5,
  driver: 120,
  phone: 15,
  location: 500,
} as const;

export type SpotDraftFields = { [K in keyof typeof fieldLimits]: string };
export type SpotDraftResult = { ok: boolean; message?: string };

export async function saveCustomerSpotDraft(
  accountId: string,
  claimId: string,
  input: SpotDraftFields,
): Promise<SpotDraftResult> {
  try {
    const { account } = await resolveCustomerWebScope(accountId);
    // Validated customer account / claim relationship, not a caller-supplied customer ID.
    const { claim } = await loadCustomerClaimDetail(account.id, claimId);
    if (claim.current_status !== "Draft") {
      return { ok: false, message: "This claim has already been submitted. Open Claim Details to continue." };
    }
    const fields = {} as SpotDraftFields;
    for (const key of Object.keys(fieldLimits) as Array<keyof SpotDraftFields>) {
      const value = input[key];
      if (typeof value !== "string") return { ok: false, message: "Invalid draft details." };
      fields[key] = value.trim().slice(0, fieldLimits[key]);
    }
    // Protect downstream timestamp parsing; incomplete dates remain allowed in drafts.
    for (const key of ["accidentDate", "spotDate"] as const) {
      if (fields[key] && !/^\d{4}-\d{2}-\d{2}$/.test(fields[key])) return { ok: false, message: "Invalid date in draft." };
    }
    for (const key of ["accidentTime", "spotTime"] as const) {
      if (fields[key] && !/^\d{2}:\d{2}$/.test(fields[key])) return { ok: false, message: "Invalid time in draft." };
    }
    const db = await createCustomerServerSupabaseClient();
    const { error } = await db.from("claim_spot_intimation_drafts").upsert(
      { claim_id: claim.id, customer_id: account.id, fields, updated_at: new Date().toISOString() },
      { onConflict: "claim_id" },
    );
    if (error) {
      console.error("Spot draft write failed", { code: error.code, claimId: claim.id });
      return { ok: false, message: "Could not sync draft. Your entries remain in this browser." };
    }
    return { ok: true };
  } catch (error) {
    console.error("Customer spot draft authorization/save failed", error);
    return { ok: false, message: "Could not save draft. Please check your connection." };
  }
}
