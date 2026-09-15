import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Check,
  FileText,
  GraduationCap,
  Pencil,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebSession } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function PartnerProfilePage() {
  const { identity, scope } = await getPartnerWebSession();
  const intermediary = identity.actor_kind === "intermediary" ? identity : null;

  const details = [
    {
      label: "Partner Family",
      value: intermediary?.partner_name || "Not recorded",
      icon: Users,
    },
    {
      label: "Intermediary Code",
      value: intermediary?.intermediary_code || "Not recorded",
      icon: FileText,
    },
    {
      label: "Intermediary Type",
      value: intermediary ? humanize(intermediary.intermediary_type) : "Not recorded",
      icon: ShieldCheck,
    },
    {
      label: "Partner Code",
      value: intermediary?.partner_code || "Not recorded",
      icon: FileText,
    },
    {
      label: "Access Type",
      value: humanize(scope.scope_mode),
      icon: Users,
    },
  ];

  return (
    <PartnerPortalShell title="Profile">
      <div className="space-y-4">
        <Link
          href="/partner/account"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        <section className="overflow-hidden rounded-xl bg-gradient-to-r from-[#032E65] via-[#00437E] to-[#0053A1] text-white shadow-[0_8px_24px_rgba(18,70,125,0.16)]">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-white text-[#1262D6] shadow-sm">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="truncate text-[17px] font-extrabold tracking-[-0.02em]">
                  {identity.display_name}
                </h1>
                <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#16D398]">
                  <Check className="h-2.5 w-2.5 stroke-[3] text-white" />
                </span>
              </div>
            </div>

            <Link
              href="/partner/account"
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-white/10 px-3 text-[9px] font-semibold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Pencil className="h-3 w-3" />
              Edit Account
            </Link>
          </div>

          <div className="mx-3 border-t border-white/15 sm:mx-4">
            <div className="grid divide-y divide-white/15 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
              {details.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex min-w-0 items-center gap-2.5 px-3 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[8px] font-medium text-white/70">{label}</p>
                    <p className="mt-0.5 truncate text-[9.5px] font-bold text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[#DCE6F1] bg-white px-4 py-3.5 shadow-[0_4px_16px_rgba(19,61,105,0.05)]">
          <div className="flex items-center gap-2.5 border-b border-[#DCE6F1] pb-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#EEF5FF] text-[#1262D6]">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="text-[12px] font-extrabold text-[#172846]">Access</h2>
          </div>

          <div className="grid divide-y divide-[#DCE6F1] pt-2 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <AccessMetric label="Partner Families" value={scope.partner_ids.length} />
            <AccessMetric label="Intermediaries" value={scope.intermediary_ids.length} />
            <AccessMetric label="Groups" value={scope.group_ids.length} />
            <AccessMetric label="Access" value={humanize(scope.scope_mode)} emphasized />
          </div>
        </section>

        <section className="flex items-center justify-between gap-4 rounded-xl border border-[#DCE6F1] bg-white px-4 py-3 shadow-[0_4px_16px_rgba(19,61,105,0.05)]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF5FF] text-[#1262D6]">
              <GraduationCap className="h-4 w-4" />
            </span>
            <h2 className="truncate text-[12px] font-extrabold text-[#172846]">
              Registration and qualification
            </h2>
          </div>

          <Link
            href="/partner/account/registration"
            className="inline-flex h-9 shrink-0 items-center rounded-lg bg-[#062D62] px-4 text-[9.5px] font-bold text-white transition hover:bg-[#0A3D7C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25"
          >
            Open Registration & Training
          </Link>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function AccessMetric({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string | number;
  emphasized?: boolean;
}) {
  return (
    <div className="px-3 py-2 sm:px-5">
      <p className="text-[8px] font-medium text-[#647A98]">{label}</p>
      <p
        className={`mt-1 font-extrabold text-[#0F2344] ${
          emphasized ? "text-[15px]" : "text-[14px]"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
