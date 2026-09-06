import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebSession } from "@/lib/partner-web";

export type PartnerExternalRenewalSummary = {
  due_0_7_count: number;
  due_8_15_count: number;
  due_16_30_count: number;
  due_30_count: number;
  expired_30_count: number;
  total_active_count: number;
};

export type PartnerExternalRenewalMode = "due" | "expired" | "future";
export type PartnerExternalRenewalWindow = "all" | "0_7" | "8_15" | "16_30";
export type PartnerExternalRenewalInteractionType = "call" | "whatsapp" | "note" | "follow_up";
export type PartnerExternalRenewalOutcome =
  | "contact_attempted"
  | "connected"
  | "interested"
  | "quote_requested"
  | "quote_shared"
  | "follow_up"
  | "renewed_elsewhere"
  | "invalid_contact"
  | "do_not_contact"
  | "lost";

export type PartnerExternalRenewalRow = {
  opportunity_id: string;
  batch_id: string;
  source_name: string;
  account_name: string | null;
  customer_name: string | null;
  contact_name: string | null;
  mobile: string | null;
  chassis_no: string | null;
  registration_no: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_lob: string | null;
  invoice_date: string;
  policy_start_date: string;
  policy_end_date: string;
  current_insurer: string | null;
  current_policy_no: string | null;
  opportunity_status: string;
  days_to_expiry: number;
  total_count: number;
};

export type PartnerExternalRenewalDetailOpportunity = Omit<
  PartnerExternalRenewalRow,
  "batch_id" | "days_to_expiry" | "total_count"
> & {
  last_interaction_at: string | null;
  next_follow_up_at: string | null;
};

export type PartnerExternalRenewalInteraction = {
  interaction_id: string;
  interaction_type: PartnerExternalRenewalInteractionType;
  outcome: PartnerExternalRenewalOutcome;
  note: string | null;
  follow_up_at: string | null;
  created_at: string;
};

export type PartnerExternalRenewalDetail = {
  opportunity: PartnerExternalRenewalDetailOpportunity;
  interactions: PartnerExternalRenewalInteraction[];
};

export async function getPartnerExternalRenewalSummary(): Promise<PartnerExternalRenewalSummary> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_external_renewal_summary");
  if (error || !data) throw new Error(error?.message ?? "External renewal opportunities are unavailable.");
  return data as PartnerExternalRenewalSummary;
}

export async function listPartnerExternalRenewals({
  limit = 25,
  offset = 0,
  search,
  mode = "due",
  window = "all",
}: {
  limit?: number;
  offset?: number;
  search?: string;
  mode?: PartnerExternalRenewalMode;
  window?: PartnerExternalRenewalWindow;
} = {}): Promise<PartnerExternalRenewalRow[]> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_list_external_renewals", {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
    p_mode: mode,
    p_window: window,
  });
  if (error) throw error;
  return (data ?? []) as PartnerExternalRenewalRow[];
}

export async function getPartnerExternalRenewalDetail(opportunityId: string): Promise<PartnerExternalRenewalDetail> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_external_renewal_detail", {
    p_opportunity_id: opportunityId,
  });
  if (error || !data) throw new Error(error?.message ?? "External renewal opportunity is unavailable.");
  return data as PartnerExternalRenewalDetail;
}

export async function recordPartnerExternalRenewalInteraction({
  opportunityId,
  interactionType,
  outcome,
  note,
  followUpAt,
}: {
  opportunityId: string;
  interactionType: PartnerExternalRenewalInteractionType;
  outcome: PartnerExternalRenewalOutcome;
  note?: string | null;
  followUpAt?: string | null;
}): Promise<PartnerExternalRenewalDetail> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_record_external_renewal_interaction", {
    p_opportunity_id: opportunityId,
    p_interaction_type: interactionType,
    p_outcome: outcome,
    p_note: note?.trim() || null,
    p_follow_up_at: followUpAt || null,
  });
  if (error || !data) throw new Error(error?.message ?? "Could not save the interaction.");
  return data as PartnerExternalRenewalDetail;
}
