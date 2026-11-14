import "server-only";

import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { resolveDailyReportActorIds } from "@/lib/reports/daily-activity-actor-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { fetchAllPages } from "@/lib/fetch-all-pages";

type Viewer = { id:string; role:string|null };
export type ReportEmployee = { id:string; full_name:string|null; employee_code:string|null; employee_id:string|null };
type EmployeeLink = {id:string; reporting_manager_id:string|null};
// This employee is an organizational reporting manager whose login currently has
// super_admin for unrelated operational functions. Report visibility must stay
// within his employee subtree; it must not inherit organization-wide access.
const JATIN_EMPLOYEE_ID = "63d272c7-fcdc-41c3-82ed-614d487b7ea5";

export async function loadDailyReportEmployeeDirectory(viewer:Viewer) {
  const access = await getEmployeeAccessScope(viewer.id, viewer.role, "view_reports");
  let allowedIds = resolveDailyReportActorIds(viewer.id, "all", access);
  const admin = createSupabaseAdminClient();
  const {data:viewerProfile,error:identityError}=await admin.from("profiles")
    .select("employee_id").eq("id",viewer.id).maybeSingle<{employee_id:string|null}>();
  if(identityError || !viewerProfile) throw new Error("Could not verify report viewer");
  if(viewerProfile.employee_id===JATIN_EMPLOYEE_ID && access.mode==="organization") {
    const {data:employees,error:employeeError}=await fetchAllPages<EmployeeLink,unknown>((from,to)=>admin
      .from("employees").select("id,reporting_manager_id").eq("employment_status","active")
      .order("id",{ascending:true}).range(from,to).returns<EmployeeLink[]>());
    if(employeeError) throw new Error("Could not verify employee reporting hierarchy");
    const descendants=new Set<string>([JATIN_EMPLOYEE_ID]);
    let changed=true;
    while(changed) {
      changed=false;
      for(const employee of employees??[]) {
        if(employee.reporting_manager_id && descendants.has(employee.reporting_manager_id) && !descendants.has(employee.id)) {
          descendants.add(employee.id); changed=true;
        }
      }
    }
    const {data:subtreeProfiles,error:subtreeError}=await fetchAllPages<{id:string},unknown>((from,to)=>admin
      .from("profiles").select("id").in("employee_id",[...descendants])
      .eq("is_active",true).order("id",{ascending:true}).range(from,to).returns<{id:string}[]>());
    if(subtreeError) throw new Error("Could not verify hierarchy profile links");
    allowedIds=Array.from(new Set([viewer.id,...(subtreeProfiles??[]).map(p=>p.id)]));
  }
  if (allowedIds !== null && !allowedIds.length) return {people:[] as ReportEmployee[], allowedIds:[] as string[]};
  const result = await fetchAllPages<ReportEmployee,unknown>((from,to)=>{
    let q=admin.from("profiles").select("id,full_name,employee_code,employee_id")
      .eq("is_active",true).order("id",{ascending:true}).range(from,to);
    if(allowedIds!==null) q=q.in("id",allowedIds);
    return q.returns<ReportEmployee[]>();
  });
  if(result.error) throw new Error("Could not load authorized employee directory");
  const people=result.data??[];
  if(!people.some(p=>p.id===viewer.id)) {
    const {data:self,error}=await admin.from("profiles").select("id,full_name,employee_code,employee_id")
      .eq("id",viewer.id).maybeSingle<ReportEmployee>();
    if(error) throw new Error("Could not verify current employee");
    if(self) people.push(self);
  }
  // The existing access-scope resolver defines the authorized tree. Do not derive
  // access from names, manually supplied employee codes, or browser parameters.
  const visible = people.filter(p=>allowedIds===null || allowedIds.includes(p.id));
  visible.sort((a,b)=>(a.full_name??"").localeCompare(b.full_name??"") || a.id.localeCompare(b.id));
  return {people:visible,allowedIds};
}

export function assertDailyReportEmployeeAllowed(
  targetId:string, directory:Awaited<ReturnType<typeof loadDailyReportEmployeeDirectory>>,
) {
  const authorized=directory.people.find(person=>person.id===targetId);
  // Critical: test ID membership before calling admin-powered per-person history reader.
  if(!authorized) throw new Error("Selected employee is outside your reporting scope");
  return authorized;
}
