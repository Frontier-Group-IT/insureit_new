import Link from "next/link";
import { ArrowRight, FilePlus2, Headphones, MessageCircle, Search } from "lucide-react";
import {
  CustomerAccountTabs,
  EmptyCustomerState,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { CustomerServiceRequestForm } from "@/components/customer-portal/customer-service-request-form";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  formatCustomerCompactDate,
  loadCustomerServiceActivity,
  loadCustomerSupportClaims,
  serviceActivityTone,
} from "@/lib/customer-web-phase3-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerSupportPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string; q?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const [activity, claims] = await Promise.all([
    loadCustomerServiceActivity(account.id),
    loadCustomerSupportClaims(account.id),
  ]);

  const query = params.q?.trim().toLowerCase() ?? "";
  const rows = activity.filter((item) =>
    !query ||
    [item.enquiry_no, item.subject, item.service_type, item.status, item.vehicle_no]
      .some((value) => value?.toLowerCase().includes(query)),
  );

  const summary = {
    open: activity.filter((item) => item.status === "open").length,
    inProgress: activity.filter((item) => item.status === "in_progress").length,
    resolved: activity.filter((item) => item.status === "resolved" || item.status === "closed").length,
  };

  return (
    <div className="space-y-5">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/support" />

      <section className="overflow-hidden rounded-2xl border border-[#DCE6F2] bg-gradient-to-br from-white via-[#F9FCFF] to-[#EEF6FF] px-5 py-6 shadow-[0_10px_28px_rgba(28,50,82,.05)] sm:px-7 sm:py-7">
        <div className="max-w-[720px]">
          <h1 className="text-[clamp(27px,3.5vw,40px)] font-black leading-tight text-[#10213D]">
            How can we <span className="text-[#267AFF]">help?</span>
          </h1>
          <p className="mt-2 text-[12px] leading-6 text-[#647995]">
            Choose the quickest way to reach us, or raise a support ticket and track it here.
          </p>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <a href="tel:+916264911014" className="group flex items-center gap-3 rounded-2xl border border-[#D8E6F5] bg-white p-4 shadow-[0_6px_20px_rgba(28,50,82,.04)] transition hover:-translate-y-0.5 hover:border-[#9FC2EC]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EAF3FF] text-[#176BD4]"><Headphones className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><strong className="block text-[13px] font-black text-[#10213D]">Call Support</strong><span className="mt-1 block text-[10px] font-semibold text-[#71839A]">Speak directly with our support team.</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#176BD4] transition group-hover:translate-x-0.5" />
          </a>

          <a href="https://wa.me/916264911014" target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-2xl border border-[#D8E6F5] bg-white p-4 shadow-[0_6px_20px_rgba(28,50,82,.04)] transition hover:-translate-y-0.5 hover:border-[#9FC2EC]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EAF8F0] text-[#138A5B]"><MessageCircle className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><strong className="block text-[13px] font-black text-[#10213D]">WhatsApp</strong><span className="mt-1 block text-[10px] font-semibold text-[#71839A]">Message us for quick assistance.</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#138A5B] transition group-hover:translate-x-0.5" />
          </a>

          <a href="#raise-support-ticket" className="group flex items-center gap-3 rounded-2xl border border-[#D8E6F5] bg-white p-4 shadow-[0_6px_20px_rgba(28,50,82,.04)] transition hover:-translate-y-0.5 hover:border-[#9FC2EC]">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF1FF] text-[#495EC7]"><FilePlus2 className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1"><strong className="block text-[13px] font-black text-[#10213D]">Raise a Ticket</strong><span className="mt-1 block text-[10px] font-semibold text-[#71839A]">Submit a request and track progress.</span></span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#495EC7] transition group-hover:translate-x-0.5" />
          </a>
        </div>
      </section>

      <section id="support-activity" className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-[19px] font-black text-[#10213D]">My Support Requests</h2>
            <p className="mt-1 text-[10.5px] font-semibold text-[#71839A]">Track your latest support tickets, quotes and challan requests.</p>
          </div>

          <form className="flex w-full items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5 lg:w-[430px]">
            <Search className="h-4 w-4 shrink-0 text-[#73829A]" />
            <input type="hidden" name="account" value={account.id} />
            <input name="q" defaultValue={params.q ?? ""} placeholder="Search requests" className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[#10213D] outline-none" />
          </form>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E0E7F0] bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#71839A]">Open</p>
            <p className="mt-1 text-[22px] font-black tabular-nums text-[#C77822]">{summary.open}</p>
          </div>
          <div className="rounded-xl border border-[#E0E7F0] bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#71839A]">In progress</p>
            <p className="mt-1 text-[22px] font-black tabular-nums text-[#176BD4]">{summary.inProgress}</p>
          </div>
          <div className="rounded-xl border border-[#E0E7F0] bg-white px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#71839A]">Resolved</p>
            <p className="mt-1 text-[22px] font-black tabular-nums text-[#138A5B]">{summary.resolved}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,.04)]">
          {rows.length ? (
            <div className="divide-y divide-[#E8EDF4]">
              {rows.map((item) => (
                <div key={item.id} className="grid gap-3 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[11.5px] font-black text-[#10213D]">{item.enquiry_no}</p>
                      <StatusPill tone={serviceActivityTone(item.status)}>{item.status.replace("_", " ")}</StatusPill>
                    </div>
                    <p className="mt-1 truncate text-[12px] font-black text-[#263A57]">{item.subject}</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] font-semibold text-[#7A889C]">
                      {item.vehicle_no ? <span>Vehicle: <strong className="font-black text-[#52647D]">{item.vehicle_no}</strong></span> : null}
                      <span>Last updated: <strong className="font-black text-[#52647D]">{formatCustomerCompactDate(item.updated_at || item.created_at)}</strong></span>
                    </div>
                  </div>
                  <Link href={{ pathname: `/customer/support/${item.id}`, query: { account: account.id } }} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D8E1EC] bg-white px-3 py-2 text-[10px] font-black text-[#176BD4] hover:bg-[#F7FAFE]">
                    View details <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4"><EmptyCustomerState title={activity.length ? "No matching support requests" : "No support requests yet"} body={activity.length ? "Try a different search term." : "Your raised requests will appear here."} /></div>
          )}
        </div>
      </section>

      <section id="raise-support-ticket" className="scroll-mt-24 rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,.04)] sm:p-5">
        <div className="mb-4">
          <h2 className="text-[17px] font-black text-[#10213D]">Raise a Support Ticket</h2>
          <p className="mt-1 text-[10.5px] font-semibold text-[#71839A]">Tell us what you need and our team will get back to you.</p>
        </div>
        <CustomerServiceRequestForm
          mode="support_ticket"
          customerId={account.id}
          claims={claims.map((claim) => ({ id: claim.id, claim_no: claim.claim_no, status: claim.current_status }))}
        />
      </section>
    </div>
  );
}
