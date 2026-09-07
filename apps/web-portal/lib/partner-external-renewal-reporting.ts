import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebSession } from "@/lib/partner-web";

export type PartnerExternalRenewalReporting = {
  total_opportunities: number;
  contacted_count: number;
  connected_count: number;
  quote_requested_count: number;
  quote_shared_count: number;
  converted_count: number;
  closed_without_conversion_count: number;
  conversion_rate_pct: number;
  premium_generated: number;
};

export async function getPartnerExternalRenewalReporting(): Promise<PartnerExternalRenewalReporting> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_external_renewal_reporting");
  if (error || !data) throw new Error(error?.message ?? "External renewal reporting is unavailable.");
  return data as PartnerExternalRenewalReporting;
}
