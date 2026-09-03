import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebSession } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const titles: Record<string, string> = {
  business: "My Business",
  customers: "Customers",
  policies: "Policies",
  renewals: "Renewals",
  claims: "Claims",
  "policy-intakes": "Policy Intake",
  payout: "Payout",
  network: "Network",
  search: "Search",
  activity: "Activity",
  profile: "Profile",
  support: "Support",
};

export default async function PartnerSectionPlaceholder({ params }: { params: Promise<{ section: string[] }> }) {
  await getPartnerWebSession();
  const { section } = await params;
  const key = section[0] ?? "";
  const title = titles[key] ?? "Partner Workspace";

  return (
    <PartnerPortalShell title={title}>
      <section className="rounded-[26px] border border-[#D7E0EC] bg-white px-5 py-8 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:px-8">
        <div className="mx-auto max-w-xl text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]">
            <Construction className="h-6 w-6" />
          </span>
          <p className="mt-5 text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Partner Web Foundation</p>
          <h2 className="mt-1 text-[22px] font-extrabold tracking-[-0.02em] text-[#152746]">{title}</h2>
          <p className="mt-2 text-[11px] font-medium leading-5 text-[#74839A]">
            This module is connected to the new Partner workspace shell and will be implemented in the next scoped portal slices using the existing Partner-authorized backend contracts.
          </p>
          <Link href="/partner" className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#111A35] px-4 text-[11px] font-bold text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Partner Home
          </Link>
        </div>
      </section>
    </PartnerPortalShell>
  );
}
