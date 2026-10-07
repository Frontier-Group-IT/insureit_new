import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { getServerAccessToken } from "@/lib/auth-server";
import type { Profile } from "@/lib/auth-config";

export type CustomerWebAccount = {
  id: string;
  customer_name: string | null;
  contact_name: string | null;
};

export type CustomerWebSession = {
  user: { id: string; email?: string };
  profile: Profile;
  accounts: CustomerWebAccount[];
  primary_customer_id: string | null;
};

export const getCustomerWebSession = cache(async (): Promise<CustomerWebSession> => {
  const accessToken = await getServerAccessToken();
  if (!accessToken) redirect("/customer/login");

  // Customer Web uses Supabase Auth's server verification endpoint directly.
  // This is compatible with Cloudflare/OpenNext and avoids getClaims(), which
  // is used by the shared admin auth helper but is unreliable in this runtime.
  const supabase = createSupabaseWithAccessToken(accessToken);
  const {
    data: { user: authUser },
    error: userError,
  } = await supabase.auth.getUser(accessToken);

  if (userError || !authUser) {
    redirect("/customer/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", authUser.id)
    .maybeSingle<Profile>();

  if (profileError || !profile?.is_active || profile.role !== "customer") {
    redirect("/access-denied");
  }

  const user = {
    id: authUser.id,
    email: authUser.email || undefined,
  };

  const [directResult, membershipResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_name, contact_name")
      .eq("profile_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("customer_memberships")
      .select("customer_id, is_primary, updated_at")
      .eq("profile_id", user.id)
      .eq("status", "active")
      .order("is_primary", { ascending: false })
      .order("updated_at", { ascending: false }),
  ]);

  if (directResult.error || membershipResult.error) {
    redirect("/access-denied");
  }

  const directAccounts = (directResult.data ?? []) as CustomerWebAccount[];
  const membershipIds = Array.from(
    new Set((membershipResult.data ?? []).map((row) => row.customer_id).filter(Boolean)),
  );

  let memberAccounts: CustomerWebAccount[] = [];
  if (membershipIds.length > 0) {
    const members = await supabase
      .from("customers")
      .select("id, customer_name, contact_name")
      .in("id", membershipIds);
    if (members.error) redirect("/access-denied");
    memberAccounts = (members.data ?? []) as CustomerWebAccount[];
  }

  const accountById = new Map<string, CustomerWebAccount>();
  for (const account of [...directAccounts, ...memberAccounts]) accountById.set(account.id, account);
  const accounts = Array.from(accountById.values());

  const primaryMembershipId =
    (membershipResult.data ?? []).find((row) => row.is_primary)?.customer_id
    ?? membershipIds[0]
    ?? directAccounts[0]?.id
    ?? null;

  return {
    user,
    profile,
    accounts,
    primary_customer_id: primaryMembershipId,
  };
});
