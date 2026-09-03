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
