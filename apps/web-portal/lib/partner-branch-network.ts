import { createServerSupabaseClient } from "@/lib/auth-server";

export type PartnerBranchNetworkContact = {
  name: string | null;
  phone: string | null;
  email: string | null;
};

export type PartnerBranchNetworkContacts = {
  branch_partner: PartnerBranchNetworkContact | null;
  branch_group: PartnerBranchNetworkContact | null;
};

export async function getPartnerBranchNetworkContacts(): Promise<PartnerBranchNetworkContacts | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_app_branch_network_contacts");

  if (error) throw new Error(error.message || "Branch network contacts are unavailable.");
  return (data ?? null) as PartnerBranchNetworkContacts | null;
}
