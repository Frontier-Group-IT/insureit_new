import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/master-data-server";

export default async function LegacyFinanceReportRedirect() {
  const profile = await requireCapability("view_reports");
  if(profile.role==="backoffice_executive")redirect("/access-denied");
  redirect("/reports/business");
}
