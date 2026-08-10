import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authenticated = await getAuthenticatedProfile(await getServerAccessToken());
  const profile = authenticated.profile;
  if (!profile?.id || !profile.is_active || !(await hasEffectiveCapability(profile, "manage_assistant_knowledge", "approve"))) {
    return NextResponse.json({ error: "assistant_knowledge_forbidden" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const workbook = XLSX.utils.book_new();
  const metadata = XLSX.utils.aoa_to_sheet([
    ["Key", "Value"],
    ["template_version", "1"],
    ["content_version", "1"],
    ["knowledge_base_name", "Operations handbook"],
    ["owner", "Business owner name or function"],
    ["classification", "internal"],
  ]);
  const knowledge = XLSX.utils.aoa_to_sheet([
    ["Route", "Title", "Content", "Tags", "Source Reference", "Required Capabilities", "Minimum Access"],
    ["/claims", "Claim intake checklist", "Follow the approved claim intake checklist.", "claims, intake", "SOP-CLAIMS-01", "view_claims", "view"],
  ]);
  metadata["!cols"] = [{ wch: 26 }, { wch: 70 }];
  knowledge["!cols"] = [{ wch: 28 }, { wch: 34 }, { wch: 72 }, { wch: 28 }, { wch: 28 }, { wch: 34 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, metadata, "Metadata");
  XLSX.utils.book_append_sheet(workbook, knowledge, "Knowledge");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=INSUREIT_Assistant_Knowledge_v1.xlsx",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });
}
