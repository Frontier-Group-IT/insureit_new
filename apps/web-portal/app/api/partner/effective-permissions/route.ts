import { NextResponse } from "next/server";
import { createSupabaseWithAccessToken } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getEffectivePermissionAccessMap } from "@/lib/effective-permissions";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";

export const dynamic = "force-dynamic";

type Level = "none" | "view" | "edit" | "approve";
const partnerGrants: Record<string, Level> = {
  view_dashboard: "view",
  view_reports: "view",
  view_customers: "view",
  create_customers: "edit",
  view_policies: "view",
  view_claims: "view",
  view_policy_intakes: "view",
  create_policy_intakes: "edit",
  view_notifications: "view",
};

// Always resolve the grants from the authenticated user's current identity.
// For employees this is the same effective-permission engine used by Operations.
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const scoped = createSupabaseWithAccessToken(match[1]);
  const { data: auth, error: authError } = await scoped.auth.getUser(match[1]);
  if (authError || !auth.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data: identity, error: identityError } = await scoped.rpc("partner_app_current_identity");
  if (identityError || !identity || identity.auth_user_id !== auth.user.id) {
    return NextResponse.json({ error: "Partner identity unavailable." }, { status: 403 });
  }
  const admin = createSupabaseAdminClient();
  if (identity.actor_kind === "employee") {
    if (identity.profile_id !== auth.user.id) {
      return NextResponse.json({ error: "Identity mismatch." }, { status: 403 });
    }
    const { data: profile, error } = await admin.from("profiles")
      .select("id,role,is_active,employee_id").eq("id", auth.user.id).maybeSingle();
    if (error || !profile?.is_active || !profile.employee_id || profile.role !== identity.role) {
      return NextResponse.json({ error: "Employee access unavailable." }, { status: 403 });
    }
    const { data: employee } = await admin.from("employees").select("employment_status")
      .eq("id", profile.employee_id).maybeSingle();
    if (employee?.employment_status !== "active") {
      return NextResponse.json({ error: "Employee access inactive." }, { status: 403 });
    }
    const capabilities = await getEffectivePermissionAccessMap(profile);
    return NextResponse.json({ actor_kind: "employee", capabilities, can_view_insurer_commercials: canAccessPolicyCommercials(profile) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (identity.actor_kind !== "intermediary") {
    return NextResponse.json({ error: "Unsupported identity." }, { status: 403 });
  }
  // Partner/branch/group authorization remains defined by the existing portal
  // identity, commercial scope, and server/RLS operations; never inherit an
  // internal employee's administrative capabilities.
  const { data: scope, error: scopeError } = await scoped.rpc("partner_app_commercial_scope");
  if (scopeError || !scope || scope.actor_kind !== "intermediary") {
    return NextResponse.json({ error: "Partner scope unavailable." }, { status: 403 });
  }
  return NextResponse.json({ actor_kind: "intermediary", capabilities: partnerGrants, can_view_insurer_commercials: false }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
