import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { ItSuperUserFinancialDeletePanel } from "@/components/it-super-user-financial-delete-panel";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { listBillingWorkbench } from "./actions";
import { BillingWorkbench } from "./workbench";

export default async function BillingPage() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const data = await listBillingWorkbench();

  const deleteOptions = data.invoices.map((invoice) => {
    const insurer = Array.isArray(invoice.insurance_companies) ? invoice.insurance_companies[0] : invoice.insurance_companies;
    return {
      id: String(invoice.id),
      label: String(invoice.invoice_no || "Draft · no number"),
      detail: [insurer?.name ?? null, String(invoice.status), invoice.invoice_date ? String(invoice.invoice_date) : null].filter(Boolean).join(" · "),
    };
  });

  return <AppShell title="Brokerage Billing">
    <div className="mx-auto max-w-[1720px] space-y-4 pb-10">
      {profile.role === "it_super_user" ? <ItSuperUserFinancialDeletePanel entity="accounts_invoice" title="Delete Accounts draft invoice" records={deleteOptions} /> : null}
      <BillingWorkbench initialData={data} embedded />
    </div>
  </AppShell>;
}
