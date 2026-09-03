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
