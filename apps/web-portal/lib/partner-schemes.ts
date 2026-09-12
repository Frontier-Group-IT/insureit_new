import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebSession } from "@/lib/partner-web";

export type PartnerSchemeStatus = "active" | "upcoming" | "completed";

export type PartnerScheme = {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  target_type: "premium" | "policies" | "custom" | null;
  target_value: number | string | null;
  target_label: string | null;
  reward_text: string | null;
  conditions_text: string | null;
  priority: number;
  status: PartnerSchemeStatus;
};

export async function getPartnerWebActiveScheme(): Promise<PartnerScheme | null> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_web_active_scheme");

  // Scheme visibility is optional on Home. A temporary Scheme RPC problem must not
  // take down the Partner dashboard; the production schema contract still blocks
  // releases where this RPC is actually missing.
  if (error) return null;

  if (Array.isArray(data)) return (data[0] as PartnerScheme | undefined) ?? null;
  return (data as PartnerScheme | null) ?? null;
}

export async function listPartnerWebSchemes(): Promise<PartnerScheme[]> {
  await getPartnerWebSession();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_web_schemes");
  if (error) throw new Error(error.message || "Schemes are unavailable.");
  return (data ?? []) as PartnerScheme[];
}
