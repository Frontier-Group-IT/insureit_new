import Link from "next/link";
import { ArrowLeft, FileInput, Mail, Phone, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerPageHeader } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerWebSupport } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "IT";
}

function updatedLabel(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "Support scope loaded"
    : "Updated " + new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
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
      <div className="space-y-5">
        <Link href="/partner/account" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
          <ArrowLeft className="h-3.5 w-3.5" /> Account
        </Link>

        <PartnerPageHeader
          eyebrow="Support"
          title="Partner assistance"
          description="Contact support and view open work."
          action={<p className="text-[9.5px] font-semibold text-[#8190A5]">{updatedLabel(data.generated_at)}</p>}
        />

        <section className="overflow-hidden rounded-xl border border-[#DCE4ED] bg-white shadow-[0_8px_22px_rgba(30,56,92,0.04)]">
          <div className="grid xl:grid-cols-[1.25fr_1fr_1.08fr_1.55fr]">
            <div className="flex min-h-[92px] items-center gap-4 border-b border-[#E6ECF3] px-5 py-4 xl:border-b-0 xl:border-r">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[13px] font-black text-[#3156B8]">{initials(contactName)}</span>
              <div className="min-w-0">
                <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-[#7A899F]">Relationship Contact</p>
                <p className="mt-1 break-words text-[15px] font-extrabold leading-5 text-[#172846]">{contactName}</p>
                <p className="mt-1 text-[9.5px] font-medium text-[#74839A]">{contactMeta}</p>
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

            <div className="flex min-h-[92px] items-center gap-4 px-5 py-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EAF9F1] text-[#18A66F]"><UserRound className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-[#7A899F]">Current Workload</p>
                <div className="mt-2 grid grid-cols-3 divide-x divide-[#DCE4ED]">
                  <WorkloadMetric href="/partner/policy-intakes" value={data.operations.intakes_need_attention} label="Need attention" />
                  <WorkloadMetric href="/partner/policy-intakes" value={data.operations.intakes_in_progress} label="In progress" />
                  <WorkloadMetric href="/partner/claims" value={data.operations.active_claims} label="Active claims" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-[#DCE4ED] bg-white shadow-[0_8px_22px_rgba(30,56,92,0.04)]">
          <div className="flex items-center gap-3 border-b border-[#E6ECF3] px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><FileInput className="h-4.5 w-4.5" /></span>
            <div>
              <h2 className="text-[16px] font-extrabold text-[#172846]">Support overview</h2>
              <p className="mt-0.5 text-[10px] font-medium text-[#74839A]">Your dedicated relationship contact and current workload details.</p>
            </div>
          </div>

          <OverviewRow
            iconText={initials(contactName)}
            label="Relationship contact"
            value={contactName}
            subvalue={contactMeta}
          />
          <OverviewRow
            icon={Phone}
            label="Call"
            value={contact?.phone || "Phone not available"}
            href={contact?.phone ? "tel:" + contact.phone : undefined}
          />
          <OverviewRow
            icon={Mail}
            label="Email"
            value={contact?.email || "Email not available"}
            href={contact?.email ? "mailto:" + contact.email : undefined}
            last
          />
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function ContactSummary({ href, icon: Icon, label, value }: { href?: string; icon: typeof Phone; label: string; value: string }) {
  const content = (
    <>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-4.5 w-4.5" /></span>
      <div className="min-w-0">
        <p className="text-[8.5px] font-black uppercase tracking-[0.12em] text-[#7A899F]">{label}</p>
        <p className="mt-1 break-words text-[12px] font-extrabold leading-5 text-[#172846]">{value}</p>
      </div>
    </>
  );

  const className = "flex min-h-[92px] items-center gap-4 border-b border-[#E6ECF3] px-5 py-4 transition xl:border-b-0 xl:border-r";
  return href ? <a href={href} className={className + " hover:bg-[#F8FAFD]"}>{content}</a> : <div className={className}>{content}</div>;
}

function WorkloadMetric({ href, value, label }: { href: string; value: number; label: string }) {
  return (
    <Link href={href} className="min-w-0 px-3 first:pl-0 last:pr-0 hover:opacity-70">
      <span className="block text-[17px] font-extrabold leading-5 text-[#172846]">{value}</span>
      <span className="mt-1 block text-[8.5px] font-semibold leading-3 text-[#74839A]">{label}</span>
    </Link>
  );
}

function OverviewRow({
  icon: Icon,
  iconText,
  label,
  value,
  subvalue,
  href,
  last = false,
}: {
  icon?: typeof Phone;
  iconText?: string;
  label: string;
  value: string;
  subvalue?: string;
  href?: string;
  last?: boolean;
}) {
  const content = (
    <div className="grid min-h-[62px] grid-cols-[44px_minmax(140px,0.8fr)_minmax(0,2.2fr)] items-center gap-4 px-5 py-3 sm:grid-cols-[44px_230px_minmax(0,1fr)]">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-[#EEF4FF] text-[12px] font-black text-[#3156B8]">
        {Icon ? <Icon className="h-4 w-4" /> : iconText}
      </span>
      <span className="text-[10.5px] font-bold text-[#203653]">{label}</span>
      <span className="min-w-0">
        <span className="block break-words text-[12px] font-extrabold text-[#172846]">{value}</span>
        {subvalue ? <span className="mt-0.5 block text-[9.5px] font-medium text-[#74839A]">{subvalue}</span> : null}
      </span>
    </div>
  );

  const className = last ? "block" : "block border-b border-[#E6ECF3]";
  return href ? <a href={href} className={className + " transition hover:bg-[#F8FAFD]"}>{content}</a> : <div className={className}>{content}</div>;
}
