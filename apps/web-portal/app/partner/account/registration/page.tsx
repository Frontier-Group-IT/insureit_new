import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Check,
  ClipboardCheck,
  FilePenLine,
  Files,
  GraduationCap,
  IdCard,
  Mail,
  Phone,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerIcallLauncher } from "@/components/partner-portal/partner-icall-launcher";
import { getPartnerWebRegistrationOverview } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type StepTone = "complete" | "active" | "pending";

type StatusMetricProps = {
  label: string;
  value: string;
  tone?: "success" | "warning" | "neutral";
};

function humanize(value: string | null | undefined) {
  return (value || "not recorded").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Not assigned";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
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

  const trainingComplete = trainingStatus === "completed";
  const trainingActive = !trainingComplete && !["not_assigned", "assigned"].includes(trainingStatus);
  const examComplete = examStatus === "passed";
  const agreementComplete = agreementStatus === "signed";
  const iibComplete = registrationStatus === "iib_registered" || iibStatus === "registered";
  const documentsComplete = data.document_count > 0;
  const accountLabel = qualification?.final_type === "misp" ? "MISP designated person" : qualification?.final_type === "posp" ? "POSP" : "Qualification account";

  const steps: Array<{ label: string; icon: LucideIcon; tone: StepTone; status: string }> = [
    { label: "Primary information", icon: IdCard, tone: "complete", status: "Completed" },
    {
      label: data.document_count + " documents attached",
      icon: Files,
      tone: documentsComplete ? "complete" : "pending",
      status: documentsComplete ? "Completed" : "Pending",
    },
    {
      label: "Training",
      icon: GraduationCap,
      tone: trainingComplete ? "complete" : trainingActive ? "active" : "pending",
      status: trainingComplete ? "Completed" : trainingActive ? "In Progress" : "Pending",
    },
    {
      label: "Examination",
      icon: ClipboardCheck,
      tone: examComplete ? "complete" : ["allotted", "available", "in_progress"].includes(examStatus) ? "active" : "pending",
      status: examComplete ? "Completed" : ["allotted", "available", "in_progress"].includes(examStatus) ? "In Progress" : "Pending",
    },
    {
      label: "Agreement",
      icon: FilePenLine,
      tone: agreementComplete ? "complete" : ["generated", "sent", "opened"].includes(agreementStatus) ? "active" : "pending",
      status: agreementComplete ? "Completed" : ["generated", "sent", "opened"].includes(agreementStatus) ? "In Progress" : "Pending",
    },
    {
      label: "IIB registration",
      icon: Building2,
      tone: iibComplete ? "complete" : ["submission_in_progress", "submitted", "ready_for_submission"].includes(iibStatus) ? "active" : "pending",
      status: iibComplete ? "Completed" : ["submission_in_progress", "submitted", "ready_for_submission"].includes(iibStatus) ? "In Progress" : "Pending",
    },
  ];

  return (
    <PartnerPortalShell title="Registration & Training">
      <div className="space-y-4 pb-5">
        <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0C2E64] via-[#0E447F] to-[#0A4F91] text-white shadow-[0_12px_30px_rgba(17,56,108,0.18)]">
          <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between xl:px-6">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/95 text-[#1D62C7] shadow-sm">
                <Building2 className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div>
                    <p className="text-[8.5px] font-black uppercase tracking-[0.14em] text-white/65">Registration & Training</p>
                    <h1 className="mt-1 truncate text-[22px] font-extrabold tracking-[-0.025em]">{data.intermediary.display_name}</h1>
                  </div>
                  <span className="inline-flex rounded-full bg-[#19875E] px-2.5 py-1 text-[8.5px] font-bold text-white">
                    {humanize(registrationStatus)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] font-semibold text-white/75">
                  {humanize(data.intermediary.intermediary_type)} · {data.intermediary.intermediary_code || "Code not recorded"}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[430px]">
              <HeroMeta label="Partner Type" value={humanize(data.intermediary.intermediary_type)} icon={IdCard} />
              <HeroMeta label="Portal Access" value={humanize(data.intermediary.portal_access_status)} icon={ShieldCheck} />
            </div>
          </div>

          <div className="grid border-t border-white/15 bg-[#0A3B74]/45 sm:grid-cols-2 xl:grid-cols-4">
            <StatusMetric label="Account" value={humanize(data.intermediary.account_status)} tone="success" />
            <StatusMetric label="Portal Access" value={humanize(data.intermediary.portal_access_status)} tone="success" />
            <StatusMetric label="Qualification" value={qualification ? accountLabel : "Not linked"} tone={qualification ? "success" : "warning"} />
            <StatusMetric label="Registration" value={humanize(registrationStatus)} tone="success" />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-[#DCE5F1] bg-white p-4 shadow-[0_6px_20px_rgba(31,65,115,0.06)] sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EEF2FF] text-[#5C5CE2]">
                <Mail className="h-4 w-4" />
              </span>
              <h2 className="text-[13px] font-extrabold text-[#162B50]">Contact information</h2>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InfoItem label="Email" value={data.intermediary.email || "Email not recorded"} icon={Mail} />
              <InfoItem label="Mobile" value={data.intermediary.mobile || "Mobile not recorded"} icon={Phone} />
            </div>
          </section>

          <section className="rounded-2xl border border-[#DCE5F1] bg-white p-4 shadow-[0_6px_20px_rgba(31,65,115,0.06)] sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EEF2FF] text-[#5C5CE2]">
                <IdCard className="h-4 w-4" />
              </span>
              <h2 className="text-[13px] font-extrabold text-[#162B50]">Partner details</h2>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[10px]">
              <DetailPair label="Partner type" value={humanize(data.intermediary.intermediary_type)} />
              <DetailPair label="Partner code" value={data.intermediary.intermediary_code || "Not recorded"} />
              <DetailPair label="Account status" value={humanize(data.intermediary.account_status)} />
              <DetailPair label="Portal access" value={humanize(data.intermediary.portal_access_status)} />
              <DetailPair label="Qualification" value={qualification ? accountLabel : "Not linked"} />
              <DetailPair label="Documents" value={`${data.document_count} attached`} />
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-[#DCE5F1] bg-white p-4 shadow-[0_6px_20px_rgba(31,65,115,0.06)] sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6C7F9C]">Onboarding</p>
              <h2 className="mt-1 text-[15px] font-extrabold text-[#162B50]">Registration journey</h2>
            </div>
            <div className="flex items-center gap-2">
              {qualification ? <span className="text-[9px] font-bold text-[#3156B8]">{accountLabel}</span> : null}
              <span className="rounded-full bg-[#EEF3F8] px-2.5 py-1 text-[8.5px] font-bold text-[#5B6D87]">6 steps</span>
            </div>
          </div>

          <div className="mt-5 grid overflow-hidden rounded-xl border border-[#DFE7F1] sm:grid-cols-2 xl:grid-cols-6">
            {steps.map((step, index) => <TimelineStep key={step.label} number={index + 1} {...step} />)}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <section className="rounded-2xl border border-[#DCE5F1] bg-white p-4 shadow-[0_6px_20px_rgba(31,65,115,0.06)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF2FF] text-[#5C5CE2]">
                  <GraduationCap className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6C7F9C]">Training & Examination</p>
                  <h3 className="mt-1 text-[15px] font-extrabold text-[#152746]">{assignment?.training_title || (qualification ? "Training has not been assigned" : "No linked qualification account")}</h3>
                  <p className="mt-1 max-w-xl break-words text-[10px] font-medium leading-4 text-[#74839A]">
                    {trainingComplete
                      ? "Training is complete. Continue to examination when it becomes available."
                      : qualification
                        ? "Continue your training and examination in iCall."
                        : "Training becomes available after your qualification account is linked."}
                  </p>
                </div>
              </div>
              <span className="w-fit rounded-lg bg-[#EEF3F8] px-3 py-1.5 text-[9px] font-bold text-[#425672]">{humanize(trainingStatus)}</span>
            </div>

            <div className="mt-4 grid overflow-hidden rounded-xl border border-[#E1E8F1] sm:grid-cols-3">
              <MiniMetric label="Training" value={humanize(trainingStatus)} />
              <MiniMetric label="Examination" value={humanize(examStatus)} />
              <MiniMetric label="Deadline" value={dateLabel(assignment?.training_deadline)} />
            </div>

            <div className="mt-4 border-t border-[#E6ECF3] pt-4">
              {qualification && assignment ? (
                <PartnerIcallLauncher
                  buttonLabel={trainingButtonLabel(trainingStatus, examStatus)}
                  accountLabel={accountLabel}
                />
              ) : (
                <button type="button" disabled className="inline-flex h-10 items-center rounded-lg bg-[#111A35] px-4 text-[10.5px] font-bold text-white opacity-40">
                  Training unavailable
                </button>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-[#DCE5F1] bg-white p-4 shadow-[0_6px_20px_rgba(31,65,115,0.06)] sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EEF2FF] text-[#5C5CE2]">
                <ClipboardCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#6C7F9C]">Qualification</p>
                <h3 className="mt-0.5 text-[15px] font-extrabold text-[#152746]">Qualification Status</h3>
              </div>
            </div>
            <div className="mt-4 divide-y divide-[#E8EDF4]">
              <StatusRow label="Training" value={humanize(trainingStatus)} complete={trainingComplete} />
              <StatusRow label="Examination" value={humanize(examStatus)} complete={examComplete} />
              <StatusRow label="Agreement" value={humanize(agreementStatus)} complete={agreementComplete} />
              <StatusRow label="IIB" value={humanize(iibStatus)} complete={iibComplete} />
            </div>
          </section>
        </div>

        <Link href="/partner/account" className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20">
          <ArrowLeft className="h-3.5 w-3.5" /> Account
        </Link>
      </div>
    </PartnerPortalShell>
  );
}

function HeroMeta({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white/90">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[8px] font-semibold text-white/55">{label}</p>
        <p className="truncate text-[10.5px] font-extrabold text-white">{value}</p>
      </div>
    </div>
  );
}

function StatusMetric({ label, value, tone = "neutral" }: StatusMetricProps) {
  const toneClasses = {
    success: "bg-[#24A65D] text-white",
    warning: "bg-[#F59E0B] text-white",
    neutral: "bg-white/15 text-white",
  }[tone];

  return (
    <div className="flex min-h-[74px] items-center gap-3 border-b border-white/10 px-4 py-3 sm:border-r xl:border-b-0 xl:last:border-r-0">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${toneClasses}`}>
        {tone === "warning" ? <GraduationCap className="h-4 w-4" /> : <Check className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-[8px] font-semibold text-white/55">{label}</p>
        <p className="mt-0.5 truncate text-[10.5px] font-extrabold text-white">{value}</p>
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#315A91]" />
      <div className="min-w-0">
        <p className="text-[8.5px] font-semibold text-[#7B8CA4]">{label}</p>
        <p className="mt-0.5 break-words text-[10px] font-bold leading-4 text-[#213653]">{value}</p>
      </div>
    </div>
  );
}

function DetailPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <span className="shrink-0 text-[9px] font-medium text-[#71839C]">{label}</span>
      <span className="min-w-0 break-words text-[10px] font-bold text-[#203653]">{value}</span>
    </div>
  );
}

function TimelineStep({ number, label, icon: Icon, tone, status }: { number: number; label: string; icon: LucideIcon; tone: StepTone; status: string }) {
  const toneStyles = {
    complete: "bg-[#F6FBF8] text-[#2F7F52]",
    active: "bg-[#F5F7FF] text-[#3156B8]",
    pending: "bg-white text-[#73839A]",
  }[tone];

  return (
    <div className={"relative border-b border-[#E0E7EF] p-3.5 text-center sm:border-r xl:border-b-0 xl:last:border-r-0 " + toneStyles}>
      <span className="mx-auto grid h-8 w-8 place-items-center rounded-full border border-current/10 bg-white shadow-sm">
        {tone === "complete" ? <Check className="h-4 w-4" /> : <span className="text-[10px] font-black">{number}</span>}
      </span>
      <Icon className="mx-auto mt-2.5 h-4.5 w-4.5" />
      <p className="mt-2 min-h-[30px] text-[9.5px] font-extrabold leading-4 text-[#203653]">{label}</p>
      <span className="mt-2 inline-flex rounded-lg bg-white px-2 py-1 text-[8.5px] font-bold shadow-sm">{status}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[#E0E7EF] px-3 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><p className="text-[8.5px] font-black uppercase tracking-[0.08em] text-[#7A899F]">{label}</p><p className="mt-1 break-words text-[10.5px] font-extrabold leading-4 text-[#203653]">{value}</p></div>;
}

function StatusRow({ label, value, complete }: { label: string; value: string; complete: boolean }) {
  return (
    <div className="flex min-h-[48px] items-center gap-3 py-2.5">
      <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-xl " + (complete ? "bg-[#EAF7EF] text-[#2F7F52]" : "bg-[#F1F4F8] text-[#74839A]")}>
        <ShieldCheck className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-[10px] font-bold text-[#203653]">{label}</span>
      <span className="max-w-[55%] break-words text-right text-[9px] font-semibold leading-4 text-[#74839A]">{value}</span>
    </div>
  );
}
