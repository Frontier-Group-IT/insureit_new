import { NextRequest, NextResponse } from "next/server";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type EmployeeOption = { id: string; full_name: string | null; employee_code: string | null };

export async function GET(request: NextRequest) {
  const profile = await requirePospMispManager();
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!profile?.id || q.length < 2) return NextResponse.json({ options: [] });

  const admin = createSupabaseAdminClient();
  const scope = await getEmployeeAccessScope(profile.id, profile.role);
  if (scope.mode !== "organization" && scope.employeeIds.length === 0) return NextResponse.json({ options: [] });

  const needle = q.replace(/[%,()]/g, " ").trim();
  let query = admin
    .from("employees")
    .select("id, full_name, employee_code")
    .eq("employment_status", "active")
    .ilike("department", "sales")
    .or(`full_name.ilike.%${needle}%,employee_code.ilike.%${needle}%`)
    .order("full_name", { ascending: true })
    .limit(8);

  if (scope.mode !== "organization") query = query.in("id", scope.employeeIds);

  const { data, error } = await query.returns<EmployeeOption[]>();
  if (error) return NextResponse.json({ options: [] }, { status: 500 });

  return NextResponse.json({
    options: (data ?? []).map((employee) => ({
      value: employee.id,
      label: `${employee.full_name?.trim() || "Unnamed Sales Employee"}${employee.employee_code ? ` - ${employee.employee_code}` : ""}`
    }))
  });
}
