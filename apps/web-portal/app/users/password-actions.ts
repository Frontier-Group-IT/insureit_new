"use server";

import { randomBytes } from "node:crypto";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PasswordResetState = { ok: boolean; message: string; temporaryPassword: string | null };

export async function resetUserTemporaryPassword(
  targetUserId: string,
  _previous: PasswordResetState,
  formData: FormData
): Promise<PasswordResetState> {
  const fail = (message: string): PasswordResetState => ({ ok: false, message, temporaryPassword: null });
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile || profile.role !== "it_super_user" || !profile.is_active) return fail("Only an active IT Super User can reset passwords.");

  if (formData.get("confirm") !== "RESET") return fail("Enter RESET to confirm the credential change.");
  const supabase = createSupabaseAdminClient();
  const { data: target, error: lookupError } = await supabase.auth.admin.getUserById(targetUserId);
  if (lookupError || !target.user) return fail("Auth account not found.");

  // A unique, unpredictable temporary credential prevents cross-account access
  // inherent in a universal shared password.
  const temporaryPassword = randomBytes(18).toString("base64url");
  const { error } = await supabase.auth.admin.updateUserById(targetUserId, { password: temporaryPassword });
  if (error) return fail("Password reset failed. No password was displayed.");

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: profile.id,
    action: "it_super_user_temporary_password_reset",
    table_name: "auth.users",
    record_id: targetUserId,
    new_data: { credential_type: "temporary", password_logged: false }
  });
  if (auditError) {
    // Do not expose a successful credential reset without an audit trail.
    // The password may have changed already; warn explicitly instead.
    return { ok: true, message: "Password changed, but audit logging failed. Contact IT to reconcile the audit record.", temporaryPassword };
  }
  return { ok: true, message: "Temporary password issued. Copy it now and have the user replace it after your account checks.", temporaryPassword };
}
