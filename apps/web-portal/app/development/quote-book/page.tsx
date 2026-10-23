import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import QuoteBookWorkspace from "@/components/development/quote-book-workspace";
export const dynamic = "force-dynamic";
export default async function QuoteBookDevelopmentPage() {
  const profile = await requireCapability("manage_system", "approve");
  if (profile.role !== "it_super_user" && profile.role !== "super_admin") redirect("/access-denied");
  return <AppShell title="Quote & Book"><QuoteBookWorkspace /></AppShell>;
}
