import { NextResponse } from "next/server";
import { requireCapability } from "@/lib/master-data-server";
import { loadDailyReportEmployeeDirectory } from "@/lib/reports/daily-employee-directory";

export const dynamic = "force-dynamic";

export async function GET() {
  // The header is client-rendered, so always resolve the list on the server.
  // Keep the same reporting hierarchy and active-employee restrictions used
  // to authorize selected person= report URLs.
  const profile = await requireCapability("view_reports");
  try {
    const directory = await loadDailyReportEmployeeDirectory(profile);
    return NextResponse.json(
      { people: directory.people.map(({ id, full_name, employee_code }) => ({ id, full_name, employee_code })) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[daily-report] authorized employee selector unavailable", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Employee list unavailable" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
