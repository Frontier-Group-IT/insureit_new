import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const organizationIntakeRoles = new Set(["it_super_user", "it_user", "super_admin", "admin"]);

/** Read-only authorization; never use this grant for mutations. */
export async function canReadAllPartnerPolicyIntakes(identity: { actor_kind: string; profile_id?: string }): Promise<boolean> {
  if (identity.actor_kind !== "employee" || !identity.profile_id) return false;
  const { data, error } = await createSupabaseAdminClient().from("profiles")
    .select("role,is_active").eq("id", identity.profile_id).maybeSingle<{role:string|null;is_active:boolean|null}>();
  if (error || !data || data.is_active !== true) return false;
  return organizationIntakeRoles.has(data.role ?? "");
}
