import { NextResponse } from "next/server";
import { requireDailyReportEmployee, canViewDailyReportAll } from "@/lib/reports/daily-report-access";
import { loadDailyReportEmployeeDirectory } from "@/lib/reports/daily-employee-directory";

export const dynamic = "force-dynamic";

export async function GET() {
  const profile = await requireDailyReportEmployee();
  // Self-only employees may use Daily Reports but must never list colleagues.
  if (!(await canViewDailyReportAll(profile))) {
    return NextResponse.json({error:"Not permitted"}, {status:403,headers:{"Cache-Control":"private, no-store"}});
  }
  try {
    const directory = await loadDailyReportEmployeeDirectory(profile);
    return NextResponse.json(
      {people:directory.people.map(({id,full_name,employee_code})=>({id,full_name,employee_code}))},
      {headers:{"Cache-Control":"private, no-store"}},
    );
  } catch (error) {
    console.error("[daily-report] authorized employee selector unavailable",error instanceof Error?error.message:"Unknown error");
    return NextResponse.json({error:"Employee list unavailable"},{status:503,headers:{"Cache-Control":"private, no-store"}});
  }
}
