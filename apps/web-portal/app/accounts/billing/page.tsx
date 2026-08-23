import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { listBillingWorkbench } from "./actions";
import { BillingWorkbench } from "./workbench";

export default async function BillingPage() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const data = await listBillingWorkbench();
  return <AppShell title="Brokerage Billing"><BillingWorkbench initialData={data} /></AppShell>;
}
