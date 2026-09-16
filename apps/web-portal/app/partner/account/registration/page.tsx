import {
  BadgeCheck,
  Building2,
  CalendarDays,
  Check,
  ClipboardCheck,
  FileText,
  GraduationCap,
  IdCard,
  Link2,
  LogIn,
  Pencil,
  UserRound,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerIcallLauncher } from "@/components/partner-portal/partner-icall-launcher";
import { getPartnerWebRegistrationOverview } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function humanize(value: string | null | undefined) {
  return (value || "not recorded").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(parsed);
}

function trainingButtonLabel(trainingStatus: string, examStatus: string) {
  if (examStatus === "passed") return "View completion status";
  if (examStatus === "failed") return "Reattempt examination";
  if (trainingStatus === "completed" && examStatus !== "not_allotted") return "Go to examination";
  if (["opened", "in_progress"].includes(trainingStatus)) return "Continue training";
  return "Start training";
}

export default async function PartnerRegistrationPage() {
  const data = await getPartnerWebRegistrationOverview();
  const assignment = data.assignment;
  const qualification = data.qualification_application;
  const registrationStatus = qualification?.registration_status || data.primary_application.registration_status || "primary_pending";
  const trainingStatus = assignment?.training_status || "not_assigned";
  const examStatus = assignment?.exam_status || "not_allotted";
  const agreementStatus = assignment?.agreement_status || "not_generated";
  const iibStatus = assignment?.iib_registration_status || registrationStatus;
  const linkedType = qualification?.final_type === "misp" ? "MISP" : qualification?.final_type === "posp" ? "POSP" : "Qualification";
  const linkedId = qualification ? `${linkedType} linked` : "Not linked";
  const active = data.intermediary.account_status === "active" || data.intermediary.portal_access_status === "active";

  const stats = [
    { icon: UserRound, label: "Account Type", value: humanize(data.intermediary.intermediary_type) },
    { icon: Link2, label: `${linkedType} ID`, value: linkedId },
    { icon: IdCard, label: "Linked Account Status", value: qualification ? humanize(qualification.registration_status) : "Not linked" },
    { icon: UserRoundPlus, label: "Assigned RM", value: "Not assigned" },
    { icon: LogIn, label: "Portal Access", value: humanize(data.intermediary.portal_access_status) },
    { icon: CalendarDays, label: "Activation Date", value: "-" },
  ];

  return (
    <PartnerPortalShell title="Registration">
      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
        <section className="overflow-hidden rounded-2xl border border-[#173E7B] bg-gradient-to-br from-[#071D49] via-[#0A2B65] to-[#0C4A9A] text-white shadow-[0_18px_45px_rgba(7,29,73,.18)]">
          <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#315FEA] shadow-md">
                <UserRound className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">Partner Application Review</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="truncate text-[13px] font-semibold text-white/90">{data.intermediary.display_name}</p>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold">
                    {data.intermediary.intermediary_code || "Code not recorded"}
                    {active ? <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" /></span> : null}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-[190px] rounded-xl border border-white/25 bg-white/[0.06] px-3 py-2.5">
                <p className="text-[7.5px] font-bold uppercase tracking-[.08em] text-white/55">Registration</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-300" />
                  <span className="text-[10px] font-semibold text-white">{humanize(registrationStatus)}</span>
                </div>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-white/80">
                <Pencil className="h-4 w-4" />
              </span>
            </div>
          </div>

          <div className="grid border-t border-white/15 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {stats.map((stat) => <HeaderStat key={stat.label} {...stat} />)}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <InfoCard title="Identity and contact">
            <Info label="Name" value={data.intermediary.display_name} />
            <Info label="PAN" value="Not available" />
            <Info label="Aadhaar" value="Not available" />
            <Info label="Date of birth" value="-" />
            <Info label="Mobile" value={data.intermediary.mobile || "-"} />
            <Info label="Email" value={data.intermediary.email || "-"} />
          </InfoCard>

          <InfoCard title="Address, bank and tax">
            <Info label="Address" value="Not available" />
            <Info label="PIN code" value="-" />
            <Info label="Bank" value="Not available" />
            <Info label="Account" value="Not available" />
            <Info label="IFSC" value="-" />
            <Info label="GST" value="Not applicable" />
          </InfoCard>
        </section>

        <section className="rounded-2xl border border-[#D9E2F0] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.06)]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[13px] font-semibold text-[#17203A]">Documents</h2>
              <p className="mt-0.5 text-[9px] text-[#64748B]">{data.document_count} attached</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: Math.max(1, Math.min(data.document_count, 10)) }).map((_, index) => (
              <div key={index} className="relative min-h-[150px] overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-[#F7FAFF] via-[#EEF4FF] to-[#EAF0F8] p-3">
                <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[7.5px] font-bold uppercase tracking-[.04em] text-emerald-700">Uploaded</span>
                <div className="absolute inset-x-0 bottom-0 flex h-[108px] items-center justify-center bg-white/35">
                  <FileText className="h-12 w-12 text-[#6B7DA0]/45" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#D9E2F0] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.06)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                <GraduationCap className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">Training & Examination</p>
                <h3 className="mt-1 text-[13px] font-semibold text-[#17203A]">{assignment?.training_title || "Training status"}</h3>
                <p className="mt-1 text-[9px] text-[#64748B]">Training {humanize(trainingStatus)} · Examination {humanize(examStatus)}</p>
              </div>
            </div>
            {qualification && assignment ? (
              <PartnerIcallLauncher buttonLabel={trainingButtonLabel(trainingStatus, examStatus)} accountLabel={linkedType} />
            ) : (
              <span className="rounded-xl bg-[#F1F5F9] px-3 py-2 text-[9px] font-semibold text-[#64748B]">Training unavailable</span>
            )}
          </div>

          <div className="mt-4 grid overflow-hidden rounded-xl border border-[#E2E8F0] sm:grid-cols-4">
            <MiniStatus label="Training" value={humanize(trainingStatus)} done={trainingStatus === "completed"} />
            <MiniStatus label="Examination" value={humanize(examStatus)} done={examStatus === "passed"} />
            <MiniStatus label="Agreement" value={humanize(agreementStatus)} done={agreementStatus === "signed"} />
            <MiniStatus label="IIB" value={humanize(iibStatus)} done={iibStatus === "registered" || registrationStatus === "iib_registered"} />
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function HeaderStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r xl:last:border-r-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className="truncate text-[8px] font-semibold uppercase leading-none tracking-[.05em] text-white/60">{label}</p>
        <p className="mt-0.5 truncate text-[10.5px] font-semibold leading-[1.15] text-white">{value}</p>
      </div>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-h-[205px] rounded-2xl border border-[#D9E2F0] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,.06)]">
      <h2 className="text-[13px] font-semibold text-[#17203A]">{title}</h2>
      <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 items-baseline gap-1.5 text-[10.5px] leading-5"><dt className="shrink-0 font-semibold text-[#64748B]">{label}:</dt><dd className="min-w-0 break-words font-semibold text-[#0F172A]">{value}</dd></div>;
}

function MiniStatus({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#E8EDF3] px-3 py-3 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${done ? "bg-emerald-50 text-emerald-600" : "bg-[#EEF2FF] text-[#4F46E5]"}`}>
        {done ? <BadgeCheck className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-[7.5px] font-bold uppercase tracking-[.06em] text-[#64748B]">{label}</p>
        <p className="mt-0.5 truncate text-[9.5px] font-semibold text-[#17203A]">{value}</p>
      </div>
    </div>
  );
}
