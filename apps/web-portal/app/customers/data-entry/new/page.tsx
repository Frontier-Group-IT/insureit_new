import { AppShell } from "@/components/shell";
import { CustomerForm } from "@/components/forms";
import { requireCapability } from "@/lib/master-data-server";
import { createCustomerDataEntry } from "../actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewCustomerDataEntryPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireCapability("create_customers", "edit");
  const query = await searchParams;

  return (
    <AppShell title="Add Customer">
      <div className="mx-auto max-w-[1240px] pb-3">
        <div className="mb-3 rounded-xl border border-[#D7E1EE] bg-[#F8FBFF] px-4 py-3 text-[10.5px] leading-5 text-[#53657D]">
          Create the operational customer record only. KYC documents, identity verification, portal access and approval remain protected workflows for authorized users.
        </div>
        {query.error ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-semibold text-red-700">{query.error}</div> : null}
        <CustomerForm action={createCustomerDataEntry} agents={[]} submitLabel="Create Customer" />
      </div>
    </AppShell>
  );
}
