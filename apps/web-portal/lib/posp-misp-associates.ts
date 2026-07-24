import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PospMispAssociateOption = {
  id: string;
  profile_id: string | null;
  full_name: string | null;
  employee_code: string | null;
};

export async function loadPospMispAssociates(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: employees, error } = await admin
    .from("employees")
    .select("id, full_name, employee_code")
    .ilike("department", "sales")
    .eq("employment_status", "active")
    .order("full_name", { ascending: true })
    .returns<Array<{ id: string; full_name: string | null; employee_code: string | null }>>();
  if (error) throw error;

  const employeeIds = (employees ?? []).map((employee) => employee.id);
  const { data: profiles, error: profileError } = employeeIds.length
    ? await admin
      .from("profiles")
      .select("id, employee_id")
      .in("employee_id", employeeIds)
      .eq("is_active", true)
      .returns<Array<{ id: string; employee_id: string | null }>>()
    : { data: [], error: null };
  if (profileError) throw profileError;

  const profileByEmployeeId = new Map((profiles ?? []).map((profile) => [profile.employee_id, profile.id]));
  return (employees ?? []).map((employee) => ({
    ...employee,
    profile_id: profileByEmployeeId.get(employee.id) ?? null
  }));
}
