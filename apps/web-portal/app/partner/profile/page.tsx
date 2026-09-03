import Link from "next/link";
import { ArrowLeft, ShieldCheck, UserRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerWebSession } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PartnerProfilePage() {
  const { identity, scope } = await getPartnerWebSession();
  const intermediary = identity.actor_kind === "intermediary" ? identity : null;

  return (
    <PartnerPortalShell title="Profile">
      <div className="space-y-7">
        <Link href="/partner/account" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"><ArrowLeft className="h-3.5 w-3.5" /> Account</Link>

        <PartnerPageHeader
          eyebrow="Profile & Registration"
          title={identity.display_name}
          description={intermediary ? humanize(intermediary.intermediary_type) : "Partner account"}
        />

        <section>
          <div className="grid border-y border-[#DCE4ED] sm:grid-cols-2">
            <Detail label="Intermediary Code" value={intermediary?.intermediary_code || "Not recorded"} />
            <Detail label="Intermediary Type" value={intermediary ? humanize(intermediary.intermediary_type) : "Not recorded"} />
            <Detail label="Partner Family" value={intermediary?.partner_name || "Not recorded"} />
            <Detail label="Partner Code" value={intermediary?.partner_code || "Not recorded"} />
            <Detail label="Portal Status" value="Active" />
            <Detail label="Scope Mode" value={humanize(scope.scope_mode)} />
          </div>
        </section>

        <section>
          <PartnerSectionHeading title="Commercial Access" description="Your current access details." />
          <div className="mt-3">
            <PartnerMetricStrip
              items={[
                { label: "Partner Families", value: scope.partner_ids.length },
                { label: "Intermediaries", value: scope.intermediary_ids.length },
                { label: "Groups", value: scope.group_ids.length },
                { label: "Access", value: humanize(scope.scope_mode) },
              ]}
            />
          </div>
        </section>

        <section className="py-1">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><UserRound className="h-4 w-4" /></span>
            <div>
              <h3 className="text-[13px] font-extrabold text-[#172846]">Registration and qualification</h3>
              <p className="mt-1 text-[10px] font-medium leading-4 text-[#74839A]">Training, examination, agreement and IIB registration remain available through the secure Registration & Training workspace.</p>
              <Link href="/partner/account/registration" className="mt-3 inline-flex h-9 items-center rounded-lg bg-[#111A35] px-4 text-[10px] font-bold text-white transition hover:bg-[#1B2A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25">Open Registration & Training</Link>
            </div>
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="flex min-h-[54px] items-center justify-between gap-4 border-b border-[#E6ECF3] px-1 py-3.5 odd:sm:border-r sm:px-4"><p className="text-[9px] font-black uppercase tracking-[0.09em] text-[#7A899F]">{label}</p><p className="max-w-[66%] break-words text-right text-[10.5px] font-extrabold leading-4 text-[#203653]">{value}</p></div>;
}
