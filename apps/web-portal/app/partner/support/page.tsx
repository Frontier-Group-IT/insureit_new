import Link from "next/link";
import { Mail, Phone, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebSupport } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "IT";
}

export default async function PartnerSupportPage() {
  const data = await getPartnerWebSupport();
  const contact = data.relationship_contact;
  const contactName = contact?.name || "INSUREIT Operations Desk";
  const contactMeta = contact
    ? [contact.designation, contact.employee_code].filter(Boolean).join(" · ") || "Relationship owner"
    : "Relationship owner";

  return (
    <PartnerPortalShell title="Support">
      <div className="space-y-3">
        <h1 className="text-[22px] font-extrabold leading-7 tracking-[-0.02em] text-[#172846] sm:text-[24px]">Partner assistance</h1>

        <section className="overflow-hidden rounded-xl border border-[#DCE4ED] bg-white shadow-[0_6px_18px_rgba(30,56,92,0.035)]">
          <div className="grid xl:grid-cols-[1.25fr_1fr_1.08fr_1.55fr]">
            <div className="flex min-h-[78px] items-center gap-3 border-b border-[#E6ECF3] px-4 py-3 xl:border-b-0 xl:border-r">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[12px] font-black text-[#3156B8]">{initials(contactName)}</span>
              <div className="min-w-0">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#7A899F]">Relationship Contact</p>
                <p className="mt-0.5 break-words text-[14px] font-extrabold leading-5 text-[#172846]">{contactName}</p>
                <p className="mt-0.5 text-[9px] font-medium text-[#74839A]">{contactMeta}</p>
              </div>
            </div>

            <ContactSummary
              href={contact?.phone ? "tel:" + contact.phone : undefined}
              icon={Phone}
              label="Call"
              value={contact?.phone || "Phone not available"}
            />
            <ContactSummary
              href={contact?.email ? "mailto:" + contact.email : undefined}
              icon={Mail}
              label="Email"
              value={contact?.email || "Email not available"}
            />

            <div className="flex min-h-[78px] items-center gap-3 px-4 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EAF9F1] text-[#18A66F]"><UserRound className="h-4.5 w-4.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#7A899F]">Current Workload</p>
                <div className="mt-1.5 grid grid-cols-3 divide-x divide-[#DCE4ED]">
                  <WorkloadMetric href="/partner/policy-intakes" value={data.operations.intakes_need_attention} label="Need attention" />
                  <WorkloadMetric href="/partner/policy-intakes" value={data.operations.intakes_in_progress} label="In progress" />
                  <WorkloadMetric href="/partner/claims" value={data.operations.active_claims} label="Active claims" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function ContactSummary({ href, icon: Icon, label, value }: { href?: string; icon: typeof Phone; label: string; value: string }) {
  const content = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-[0.12em] text-[#7A899F]">{label}</p>
        <p className="mt-0.5 break-words text-[11.5px] font-extrabold leading-5 text-[#172846]">{value}</p>
      </div>
    </>
  );

  const className = "flex min-h-[78px] items-center gap-3 border-b border-[#E6ECF3] px-4 py-3 transition xl:border-b-0 xl:border-r";
  return href ? <a href={href} className={className + " hover:bg-[#F8FAFD]"}>{content}</a> : <div className={className}>{content}</div>;
}

function WorkloadMetric({ href, value, label }: { href: string; value: number; label: string }) {
  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}`}
      className="flex min-h-[42px] min-w-0 cursor-pointer flex-col justify-center rounded-md px-2.5 py-1 transition hover:bg-[#F4F7FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 active:bg-[#EDF2F8] first:ml-0 last:mr-0"
    >
      <span className="block text-[16px] font-extrabold leading-5 text-[#172846]">{value}</span>
      <span className="mt-0.5 block text-[8px] font-semibold leading-3 text-[#74839A]">{label}</span>
    </Link>
  );
}
