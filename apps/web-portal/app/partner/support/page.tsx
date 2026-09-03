import Link from "next/link";
import { ArrowLeft, ArrowRight, FileInput, LifeBuoy, Mail, Phone, ShieldAlert, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
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

  return (
    <PartnerPortalShell title="Support">
      <div className="space-y-7">
        <Link href="/partner/account" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653]">
          <ArrowLeft className="h-3.5 w-3.5" /> Account
        </Link>

        <PartnerPageHeader
          eyebrow="Support"
          title="Partner assistance"
          description="Your relationship contact and current Operations workload, scoped to this Partner account."
          action={<p className="text-[9.5px] font-semibold text-[#8190A5]">{updatedLabel(data.generated_at)}</p>}
        />

        <section className="overflow-hidden border-y border-[#DCE4ED]">
          {contact ? (
            <>
              <div className="flex flex-col gap-4 border-b border-[#DCE4ED] py-5 sm:flex-row sm:items-center">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[13px] font-black text-[#3156B8]">{initials(contact.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#7A899F]">Your Relationship Contact</p>
                  <h3 className="mt-1 truncate text-[18px] font-extrabold text-[#172846]">{contact.name}</h3>
                  <p className="mt-1 text-[10px] font-medium text-[#74839A]">{[contact.designation, contact.employee_code].filter(Boolean).join(" · ") || "Relationship owner"}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2">
                <ContactAction
                  href={contact.phone ? "tel:" + contact.phone : undefined}
                  icon={Phone}
                  label="Call"
                  value={contact.phone || "Phone not available"}
                />
                <ContactAction
                  href={contact.email ? "mailto:" + contact.email : undefined}
                  icon={Mail}
                  label="Email"
                  value={contact.email || "Email not available"}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4 px-5 py-6 sm:px-6">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><LifeBuoy className="h-5 w-5" /></span>
              <div>
                <h3 className="text-[14px] font-extrabold text-[#172846]">INSUREIT Operations Desk</h3>
                <p className="mt-1 text-[10px] font-medium text-[#74839A]">No dedicated relationship contact is currently available in your Partner scope.</p>
              </div>
            </div>
          )}
        </section>

        <section className="py-1">
          <PartnerSectionHeading eyebrow="Operations Desk" title="Current workload" description="Open the relevant workspace directly from here." />

          <div className="mt-3 grid border-y border-[#DCE4ED] lg:grid-cols-3">
            <OpsCard
              href="/partner/policy-intakes"
              icon={ShieldAlert}
              value={data.operations.intakes_need_attention}
              label="Need your attention"
              emphasis={data.operations.intakes_need_attention > 0}
            />
            <OpsCard
              href="/partner/policy-intakes"
              icon={FileInput}
              value={data.operations.intakes_in_progress}
              label="Policy Intakes in progress"
            />
            <OpsCard
              href="/partner/claims"
              icon={UserRound}
              value={data.operations.active_claims}
              label="Active claims"
            />
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function ContactAction({
  href,
  icon: Icon,
  label,
  value,
}: {
  href?: string;
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  const body = (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-black uppercase tracking-[0.09em] text-[#7A899F]">{label}</span>
        <span className="mt-1 block truncate text-[10.5px] font-extrabold text-[#203653]">{value}</span>
      </span>
      {href ? <ArrowRight className="h-4 w-4 text-[#8090A8]" /> : null}
    </>
  );

  return href ? (
    <a href={href} className="flex min-h-[72px] items-center gap-3 border-b border-[#E6ECF3] px-5 py-4 transition hover:bg-[#F8FAFD] sm:border-r sm:px-6 last:sm:border-r-0">
      {body}
    </a>
  ) : (
    <div className="flex min-h-[72px] items-center gap-3 border-b border-[#E6ECF3] px-5 py-4 sm:border-r sm:px-6 last:sm:border-r-0">
      {body}
    </div>
  );
}

function OpsCard({
  href,
  icon: Icon,
  value,
  label,
  emphasis = false,
}: {
  href: string;
  icon: typeof FileInput;
  value: number;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <Link href={href} className={"group flex min-h-[82px] items-center gap-3 border-b px-1 py-4 transition lg:border-b-0 lg:border-r lg:px-4 lg:last:border-r-0 " + (emphasis ? "border-[#F0D7AE] bg-[#FFF8EC]" : "border-[#E0E7EF]")}>
      <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-2xl " + (emphasis ? "bg-[#FFF1D9] text-[#A86809]" : "bg-white text-[#3156B8]")}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className={"block text-[18px] font-extrabold " + (emphasis ? "text-[#80511A]" : "text-[#162746]")}>{value}</span>
        <span className="mt-1 block text-[9.5px] font-semibold text-[#74839A]">{label}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
