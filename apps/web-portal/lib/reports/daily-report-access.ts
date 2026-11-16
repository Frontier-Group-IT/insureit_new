import "server-only";

import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { isPortalRole } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isValidDailyProfileId } from "@/lib/reports/daily-history-validation";

type DailyReportProfile = { id:string; role:string; is_active?:boolean };

/** Self is available to active, employee-linked portal logins only. */
export async function requireDailyReportEmployee():Promise<DailyReportProfile> {
  const token=await getServerAccessToken();
  const {profile}=await getAuthenticatedProfile(token);
  if(!profile) redirect("/login");
  if(!profile.is_active || !isPortalRole(profile.role) || !isValidDailyProfileId(profile.id))
    redirect("/access-denied");

  const admin=createSupabaseAdminClient();
  const {data:linked,error:profileError}=await admin.from("profiles")
    .select("employee_id").eq("id",profile.id).eq("is_active",true)
    .maybeSingle<{employee_id:string|null}>();
  if(profileError || !linked?.employee_id) redirect("/access-denied");

  const {data:employee,error:employeeError}=await admin.from("employees")
    .select("id").eq("id",linked.employee_id).eq("employment_status","active")
    .maybeSingle<{id:string}>();
  if(employeeError || !employee) redirect("/access-denied");
  return profile;
}

/** Preserve existing report permissions; opening Self never grants All access. */
export function dailyReportAllRoleAllowed(role:string|null|undefined) {
  // These roles were restricted from /reports/daily by middleware before
  // the employee Self-access change. Keep that separation of duties.
  return role!=="accounts" && role!=="claims_head" && role!=="sales_executive" && role!=="operations_head_life";
}

export async function canViewDailyReportAll(profile:DailyReportProfile) {
  return dailyReportAllRoleAllowed(profile.role) && await hasEffectiveCapability(profile,"view_reports","view");
}
