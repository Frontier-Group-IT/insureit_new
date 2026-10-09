import Link from "next/link";
import { ArrowLeft, Headphones } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  formatCustomerCompactDate,
  loadCustomerServiceActivityDetail,
  serviceActivityLabel,
  serviceActivityTone,
} from "@/lib/customer-web-phase3-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerSupportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ account?: string }>;
}) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const item = await loadCustomerServiceActivityDetail(account.id, id);

  return (
    <div className="space-y-5">
      <Link href={{ pathname: "/customer/support", query: { account: account.id } }} className="inline-flex items-center gap-1 text-[11px] font-black text-[#53627A]"><ArrowLeft className="h-3.5 w-3.5" />Back to Support</Link>
      <CustomerPageHeading eyebrow={serviceActivityLabel(item.service_type)} title={item.enquiry_no} description={item.subject} action={<StatusPill tone={serviceActivityTone(item.status)}>{item.status.replace("_"," ")}</StatusPill>} />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/support" />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
          <div className="flex items-center gap-2"><Headphones className="h-4 w-4 text-[#174EA6]" /><h2 className="text-[13px] font-black text-[#10213D]">Request details</h2></div>
          <div className="customer-detail-grid mt-2">
            {[
              ["Service", serviceActivityLabel(item.service_type)],
              ["Reference", item.enquiry_no],
              ["Vehicle", item.vehicle_no || "—"],
              ["Category", item.category || "—"],
              ["Priority", item.priority || "—"],
              ["Created", formatCustomerCompactDate(item.created_at)],
              ["Updated", formatCustomerCompactDate(item.updated_at)],
            ].map(([label,value]) => <div key={label} className="customer-detail-row"><span className="customer-detail-label">{label}</span><span className="customer-detail-value">{value}</span></div>)}
          </div>
          <div className="mt-4 rounded-xl bg-[#F7F9FC] p-3"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8794A7]">Details</p><p className="mt-1 whitespace-pre-wrap text-[11px] font-semibold leading-5 text-[#45546A]">{item.description}</p></div>
        </section>
        <aside className="rounded-2xl border border-[#CFE0FF] bg-[#F5F8FD] p-4">
          <p className="text-[11px] font-black text-[#10213D]">INSUREIT support can see this request.</p>
          <p className="mt-2 text-[10px] font-semibold leading-5 text-[#64748B]">This web phase keeps the support thread read-only. Replies and file attachments remain in the Customer App until the web messaging/upload flow receives its own security review.</p>
        </aside>
      </div>
    </div>
  );
}