import { redirect } from "next/navigation";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
export default async function PartnerOperationsReport() {
  await requirePartnerReportScope();
  redirect("/partner/reports");
}
