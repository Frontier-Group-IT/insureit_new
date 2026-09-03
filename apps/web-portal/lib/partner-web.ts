import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";

export type PartnerIdentity =
  | {
      actor_kind: "employee";
      auth_user_id: string;
      profile_id: string;
      role: string;
      employee_id: string;
      employee_code: string;
      display_name: string;
      designation: string | null;
    }
  | {
      actor_kind: "intermediary";
      auth_user_id: string;
      portal_account_id: string;
      intermediary_id: string;
      intermediary_type: "partner" | "posp" | "misp";
      intermediary_code: string | null;
      display_name: string;
      partner_id: string;
      partner_code: string;
      partner_name: string;
    };

export type PartnerCommercialScope = {
  actor_kind: "employee" | "intermediary";
  scope_mode: "organization" | "hierarchy" | "self" | "partner_family" | "none";
  employee_ids: string[];
  partner_ids: string[];
  intermediary_ids: string[];
  group_ids: string[];
};

export type PartnerSessionContext = {
  identity: PartnerIdentity;
  scope: PartnerCommercialScope;
};

export type PartnerHomeData = {
  generated_at: string;
  business: {
    premium_this_month: number | string;
    premium_last_month: number | string;
    premium_change_percent: number | string;
    policies_this_month: number;
    active_policies: number;
    total_customers: number;
    customers_this_month: number;
    renewals_7_days: number;
    renewals_30_days: number;
    overdue_policies: number;
    renewal_premium_7_days: number | string;
    renewal_premium_30_days: number | string;
  };
  service: {
    active_claims: number;
    claims_need_attention: number;
    claims_updated_today: number;
    intakes_need_attention: number;
    intakes_in_progress: number;
  };
  impact: {
    active_vehicles: number;
    customers_served: number;
    claims_assisted: number;
    claim_settlement_value: number | string;
    active_motor_idv: number | string;
  };
  pulse: {
    business_momentum: "rising" | "steady" | "slower";
    renewal_readiness: "clear" | "attention";
    service_status: "steady" | "attention";
    action_status: "clear" | "attention";
  };
  today: {
    kind: "intake_attention" | "renewal" | "claim";
    title: string;
    subtitle: string;
    count: number;
    route: string;
  }[];
};

export const getPartnerWebSession = cache(async (): Promise<PartnerSessionContext> => {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);

  if (!profile?.id || profile.role !== "intermediary" || !profile.is_active) {
    redirect("/access-denied");
  }

  const supabase = await createServerSupabaseClient();
  const { data: existingIdentity, error: identityError } = await supabase.rpc("partner_app_current_identity");
  if (identityError) redirect("/access-denied");

  let identity = existingIdentity as PartnerIdentity | null;
  if (!identity) {
    const { data: activatedIdentity, error: activationError } = await supabase.rpc("partner_app_activate_current_account");
    if (activationError) redirect("/access-denied");
    identity = activatedIdentity as PartnerIdentity | null;
  }

  if (!identity || identity.actor_kind !== "intermediary") redirect("/access-denied");

  const { data: scope, error: scopeError } = await supabase.rpc("partner_app_commercial_scope");
  if (scopeError || !scope) redirect("/access-denied");

  const resolvedScope = scope as PartnerCommercialScope;
  if (resolvedScope.actor_kind !== "intermediary" || resolvedScope.scope_mode === "none") {
    redirect("/access-denied");
  }

  return { identity, scope: resolvedScope };
});

export async function getPartnerWebHome(): Promise<PartnerHomeData> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_home");
  if (error || !data) throw new Error(error?.message ?? "Partner Home is unavailable.");
  return data as PartnerHomeData;
}


export type PartnerBusinessPerformance = {
  generated_at: string;
  scope_mode: "organization" | "hierarchy" | "self" | "partner_family" | "none";
  current_month: string;
  premium_this_month: number | string;
  premium_last_month: number | string;
  policies_this_month: number;
  policies_last_month: number;
  total_policies: number;
  total_customers: number;
  lifetime_gross_premium: number | string;
  premium_change_percent: number | string;
  trend: { month: string; premium: number | string; policies: number }[];
  business_mix: { label: string; policies: number; premium: number | string }[];
};

export type PartnerBusinessRangeSummary = {
  generated_at: string;
  from_date: string;
  to_date: string;
  premium: number | string;
  premium_previous_period: number | string;
  premium_change_percent: number | string;
  policies: number;
  customers: number;
  renewals: number;
  claims: number;
};

export type PartnerCustomerSummary = {
  total_customers: number;
  active_customers: number;
  with_phone: number;
  with_email: number;
};

export type PartnerCustomerRow = {
  customer_id: string;
  customer_code: string | null;
  customer_name: string;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  customer_type: string | null;
  fleet_size_band: string | null;
  customer_status: string | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  created_at: string;
  total_count: number;
};

export type PartnerCustomerDetail = {
  customer: {
    id: string;
    customer_code: string | null;
    customer_name: string;
    company_name: string | null;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    state: string | null;
    customer_type: string | null;
    fleet_size_band: string | null;
    status: string | null;
    created_at: string;
    intermediary_type: string | null;
    intermediary_code: string | null;
  };
  summary: {
    policies: number;
    vehicles: number;
    claims: number;
    renewals_30_days: number;
  };
  policies: {
    policy_id: string;
    policy_no: string | null;
    policy_code: string | null;
    policy_type: string | null;
    policy_product: string | null;
    end_date: string | null;
    premium_amount: number | string | null;
    insurer_name: string | null;
    vehicle_no: string | null;
  }[];
  vehicles: {
    vehicle_id: string;
    vehicle_no: string | null;
    vehicle_type: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    fitness_expiry_date: string | null;
    puc_expiry_date: string | null;
    road_tax_expiry_date: string | null;
    national_permit_expiry_date: string | null;
    local_permit_expiry_date: string | null;
  }[];
  claims: {
    claim_id: string;
    claim_no: string | null;
    current_status: string | null;
    created_at: string;
    vehicle_no: string | null;
    insurer_name: string | null;
  }[];
};

export async function getPartnerWebBusinessPerformance(): Promise<PartnerBusinessPerformance> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_business_performance");
  if (error || !data) throw new Error(error?.message ?? "Business performance is unavailable.");
  return data as PartnerBusinessPerformance;
}

export async function getPartnerWebBusinessRange(fromDate: string, toDate: string): Promise<PartnerBusinessRangeSummary> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_business_range", {
    p_from_date: fromDate,
    p_to_date: toDate,
  });
  if (error || !data) throw new Error(error?.message ?? "Business summary is unavailable for this date range.");
  return data as PartnerBusinessRangeSummary;
}

export async function getPartnerWebCustomerSummary(): Promise<PartnerCustomerSummary> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_customer_summary");
  if (error || !data) throw new Error(error?.message ?? "Customer summary is unavailable.");
  return data as PartnerCustomerSummary;
}

export async function listPartnerWebCustomers({
  limit = 25,
  offset = 0,
  search,
}: {
  limit?: number;
  offset?: number;
  search?: string;
} = {}): Promise<PartnerCustomerRow[]> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_list_customers", {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
  });
  if (error) throw error;
  return (data ?? []) as PartnerCustomerRow[];
}

export async function getPartnerWebCustomerDetail(customerId: string): Promise<PartnerCustomerDetail> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_customer_detail", {
    p_customer_id: customerId,
  });
  if (error || !data) throw new Error(error?.message ?? "Customer detail is unavailable.");
  return data as PartnerCustomerDetail;
}


export type PartnerPolicyLifecycle = "all" | "in_force" | "expiring" | "expired" | "upcoming";

export type PartnerPolicySummary = {
  total_policies: number;
  in_force_policies: number;
  expiring_30_days: number;
  expired_policies: number;
  upcoming_policies: number;
  total_premium: number | string;
  motor_policies: number;
};

export type PartnerPolicyRow = {
  policy_id: string;
  policy_code: string | null;
  policy_no: string | null;
  policy_type: string | null;
  policy_product: string | null;
  business_line: string | null;
  business_type: string | null;
  start_date: string | null;
  end_date: string | null;
  issuance_date: string | null;
  premium_amount: number | string | null;
  policy_status: string | null;
  lifecycle_status: Exclude<PartnerPolicyLifecycle, "all">;
  customer_id: string | null;
  customer_name: string;
  vehicle_id: string | null;
  vehicle_no: string | null;
  insurer_name: string | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  rm_name: string | null;
  intermediary_group_code: string | null;
  intermediary_group_name: string | null;
  total_count: number;
};

export type PartnerRenewalSummary = {
  overdue_count: number;
  overdue_premium: number | string;
  due_0_7_count: number;
  due_0_7_premium: number | string;
  due_8_15_count: number;
  due_8_15_premium: number | string;
  due_16_30_count: number;
  due_16_30_premium: number | string;
  due_30_count: number;
  due_30_premium: number | string;
};

export type PartnerPolicyDetail = {
  policy: {
    id: string;
    policy_code: string | null;
    policy_no: string | null;
    policy_type: string | null;
    policy_product: string | null;
    business_line: string | null;
    business_type: string | null;
    start_date: string | null;
    end_date: string | null;
    issuance_date: string | null;
    status: string | null;
    insured_declared_value: number | string | null;
    lifecycle_status: Exclude<PartnerPolicyLifecycle, "all">;
  };
  premium: {
    gross_premium: number | string | null;
    net_premium: number | string | null;
    od_premium: number | string | null;
    tp_premium: number | string | null;
    cpa_opted: boolean | null;
    cpa_amount: number | string | null;
    gst_amount: number | string | null;
  };
  customer: {
    id: string | null;
    name: string;
    customer_code: string | null;
  };
  vehicle: {
    id: string;
    vehicle_no: string | null;
    vehicle_type: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    vehicle_category: string | null;
    is_commercial: boolean | null;
  } | null;
  insurer: {
    id: string | null;
    name: string | null;
  };
  commercial: {
    intermediary_type: string | null;
    intermediary_code: string | null;
    rm_name: string | null;
    group_code: string | null;
    group_name: string | null;
  };
};

export async function getPartnerWebPolicySummary(): Promise<PartnerPolicySummary> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_policy_summary");
  if (error || !data) throw new Error(error?.message ?? "Policy summary is unavailable.");
  return data as PartnerPolicySummary;
}

export async function listPartnerWebPolicies({
  limit = 25,
  offset = 0,
  search,
  lifecycle = "all",
}: {
  limit?: number;
  offset?: number;
  search?: string;
  lifecycle?: PartnerPolicyLifecycle;
} = {}): Promise<PartnerPolicyRow[]> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_list_policies", {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
    p_lifecycle: lifecycle,
  });
  if (error) throw error;
  return (data ?? []) as PartnerPolicyRow[];
}

export async function getPartnerWebRenewalSummary(): Promise<PartnerRenewalSummary> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_renewal_summary");
  if (error || !data) throw new Error(error?.message ?? "Renewal summary is unavailable.");
  return data as PartnerRenewalSummary;
}

export async function getPartnerWebPolicyDetail(policyId: string): Promise<PartnerPolicyDetail> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_policy_detail", { p_policy_id: policyId });
  if (error || !data) throw new Error(error?.message ?? "Policy detail is unavailable.");
  return data as PartnerPolicyDetail;
}


export type PartnerClaimState = "all" | "active" | "completed";

export type PartnerClaimSummary = {
  total_claims: number;
  active_claims: number;
  completed_claims: number;
  assistance_requested: number;
};

export type PartnerClaimRow = {
  claim_id: string;
  claim_no: string | null;
  insurer_claim_no: string | null;
  current_status: string | null;
  claim_state: Exclude<PartnerClaimState, "all">;
  claim_service_mode: string | null;
  assistance_status: string | null;
  customer_id: string;
  customer_name: string;
  vehicle_id: string | null;
  vehicle_no: string | null;
  policy_no: string | null;
  insurer_name: string | null;
  accident_at: string | null;
  estimated_loss: number | string | null;
  approved_amount: number | string | null;
  settlement_amount: number | string | null;
  created_at: string;
  total_count: number;
};

export type PartnerClaimDetail = {
  claim: {
    id: string;
    claim_no: string | null;
    insurer_claim_no: string | null;
    current_status: string | null;
    claim_service_mode: string | null;
    assistance_status: string | null;
    accident_at: string | null;
    accident_location: string | null;
    estimated_loss: number | string | null;
    approved_amount: number | string | null;
    settlement_amount: number | string | null;
    created_at: string;
    updated_at: string;
  };
  customer: { id: string; name: string; customer_code: string | null };
  vehicle: { id: string | null; vehicle_no: string | null };
  policy: { policy_no: string | null };
  insurer: { name: string | null };
  status_history: { id: string; from_status: string | null; to_status: string | null; created_at: string }[];
  stages: { id: string; stage: string; created_at: string }[];
};

export async function getPartnerWebClaimSummary(): Promise<PartnerClaimSummary> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_claim_summary");
  if (error || !data) throw new Error(error?.message ?? "Claim summary is unavailable.");
  return data as PartnerClaimSummary;
}

export async function listPartnerWebClaims({
  limit = 25,
  offset = 0,
  search,
  state = "all",
}: {
  limit?: number;
  offset?: number;
  search?: string;
  state?: PartnerClaimState;
} = {}): Promise<PartnerClaimRow[]> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_list_claims", {
    p_limit: limit,
    p_offset: offset,
    p_search: search?.trim() || null,
    p_state: state,
  });
  if (error) throw error;
  return (data ?? []) as PartnerClaimRow[];
}

export async function getPartnerWebClaimDetail(claimId: string): Promise<PartnerClaimDetail> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_claim_detail", { p_claim_id: claimId });
  if (error || !data) throw new Error(error?.message ?? "Claim detail is unavailable.");
  return data as PartnerClaimDetail;
}


export type PartnerPayoutRecent = {
  id: string;
  policy_id: string;
  policy_no: string;
  customer_name: string;
  amount: number | string;
  status: string;
  commercial_status: string;
  payout_date: string | null;
  voucher_number: string | null;
  updated_at: string;
};

export type PartnerPayoutSummary =
  | {
      available: false;
      visibility: "restricted";
      generated_at: string;
      reason: string;
    }
  | {
      available: true;
      visibility: "self";
      generated_at: string;
      intermediary_code: string;
      recorded_amount: number | string;
      pending_amount: number | string;
      eligible_amount: number | string;
      needs_review_amount: number | string;
      paid_amount: number | string;
      total_rows: number;
      pending_count: number;
      paid_count: number;
      needs_review_count: number;
      recent: PartnerPayoutRecent[];
    };

export type PartnerNetworkChild = {
  intermediary_id: string;
  type: "posp" | "misp";
  code: string | null;
  name: string;
};

export type PartnerNetworkRow = {
  partner_id: string;
  partner_code: string;
  partner_name: string;
  partner_kind: string;
  owner: {
    employee_id: string | null;
    employee_code: string | null;
    name: string | null;
    designation: string | null;
  };
  group: {
    group_id: string;
    group_code: string;
    group_name: string;
  } | null;
  children: PartnerNetworkChild[];
  child_count: number;
  posp_count: number;
  misp_count: number;
  metrics: {
    premium_this_month: number | string;
    policies_this_month: number;
    total_policies: number;
    total_customers: number;
    renewals_30_days: number;
    active_claims: number;
  };
};

export type PartnerNetworkData = {
  generated_at: string;
  scope_mode: "organization" | "hierarchy" | "self" | "partner_family" | "none";
  total_partners: number;
  total_groups: number;
  partners: PartnerNetworkRow[];
};

export async function getPartnerWebPayoutSummary(): Promise<PartnerPayoutSummary> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_payout_summary");
  if (error || !data) throw new Error(error?.message ?? "Partner payout information is unavailable.");
  return data as PartnerPayoutSummary;
}

export async function getPartnerWebNetwork(): Promise<PartnerNetworkData> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_network");
  if (error || !data) throw new Error(error?.message ?? "Commercial network is unavailable.");
  return data as PartnerNetworkData;
}
