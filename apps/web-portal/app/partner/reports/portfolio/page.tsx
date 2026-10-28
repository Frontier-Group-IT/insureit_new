import { redirect } from "next/navigation";
import { requirePartnerReportScope } from "@/lib/reports/partner-report-scope";
export default async function PartnerPortfolioReport() {
  await requirePartnerReportScope();
  redirect("/partner/reports");
}
