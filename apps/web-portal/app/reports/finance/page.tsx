import { redirect } from "next/navigation";

export default function LegacyBusinessReportRedirect() {
  redirect("/reports/business");
}
