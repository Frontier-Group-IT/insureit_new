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
      <div className="space-y-4">
        <Link href="/partner/account" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653]">
          <ArrowLeft className="h-3.5 w-3.5" /> Account
        </Link>

        <section className="overflow-hidden rounded-[26px] border border-[#D7E0EC] bg-white shadow-[0_16px_45px_rgba(34,56,89,.07)]">
          <div className="bg-[#111A35] px-5 py-6 text-white sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/55">Registration & Training</p>
                <h2 className="mt-1 truncate text-[23px] font-extrabold tracking-[-0.025em]">{data.intermediary.display_name}</h2>
                <p className="mt-1 text-[10.5px] font-medium text-white/65">{humanize(data.intermediary.intermediary_type)} · {data.intermediary.intermediary_code || "Code not recorded"}</p>
              </div>
              <span className="inline-flex w-fit rounded-xl bg-white/10 px-3 py-1.5 text-[9.5px] font-bold text-white">{humanize(registrationStatus)}</span>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[9.5px] font-medium text-white/70">
              <span className="inline-flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {data.intermediary.email || "Email not recorded"}</span>
              <span className="inline-flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {data.intermediary.mobile || "Mobile not recorded"}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            <HeaderMetric label="Account" value={humanize(data.intermediary.account_status)} />
            <HeaderMetric label="Portal Access" value={humanize(data.intermediary.portal_access_status)} />
            <HeaderMetric label="Qualification" value={qualification ? accountLabel : "Not linked"} />
            <HeaderMetric label="Registration" value={humanize(registrationStatus)} />
          </div>
        </section>

        <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#687A96]">Onboarding</p>
              <h3 className="mt-1 text-[16px] font-extrabold text-[#152746]">Registration journey</h3>
            </div>
            {qualification ? <span className="rounded-xl bg-[#EEF4FF] px-3 py-1.5 text-[9px] font-bold text-[#3156B8]">{accountLabel}</span> : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {steps.map((step, index) => <TimelineStep key={step.label} number={index + 1} {...step} />)}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#687A96]">Training & Examination</p>
                <h3 className="mt-1 text-[16px] font-extrabold text-[#152746]">{assignment?.training_title || (qualification ? "Training has not been assigned" : "No linked qualification account")}</h3>
                <p className="mt-1 max-w-xl text-[10px] font-medium leading-4 text-[#74839A]">
                  {trainingComplete
                    ? "Training is complete. Use the secure iCall session to continue to examination when allotted."
                    : qualification
                      ? "Learning and examination continue through the secure iCall portal using your authorized qualification account."
                      : "Training becomes available after a POSP or MISP qualification account is linked."}
                </p>
              </div>
              <span className="rounded-xl bg-[#EEF3F8] px-3 py-1.5 text-[9px] font-bold text-[#425672]">{humanize(trainingStatus)}</span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Training" value={humanize(trainingStatus)} />
              <MiniMetric label="Examination" value={humanize(examStatus)} />
              <MiniMetric label="Deadline" value={dateLabel(assignment?.training_deadline)} />
            </div>

            <div className="mt-5 border-t border-[#E6ECF3] pt-4">
              {qualification && assignment ? (
                <PartnerIcallLauncher
                  buttonLabel={trainingButtonLabel(trainingStatus, examStatus)}
                  accountLabel={accountLabel}
                />
              ) : (
                <button type="button" disabled className="inline-flex h-10 items-center rounded-xl bg-[#111A35] px-4 text-[10.5px] font-bold text-white opacity-40">
                  Training unavailable
                </button>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#687A96]">Qualification Status</p>
            <div className="mt-4 divide-y divide-[#E8EDF4]">
              <StatusRow label="Training" value={humanize(trainingStatus)} complete={trainingComplete} />
              <StatusRow label="Examination" value={humanize(examStatus)} complete={examComplete} />
              <StatusRow label="Agreement" value={humanize(agreementStatus)} complete={agreementComplete} />
              <StatusRow label="IIB" value={humanize(iibStatus)} complete={iibComplete} />
            </div>
          </section>
        </div>
      </div>
    </PartnerPortalShell>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return <div className="border-b border-[#E6ECF3] px-5 py-4 sm:border-r sm:px-6 xl:border-b-0 xl:last:border-r-0"><p className="text-[8.5px] font-black uppercase tracking-[0.09em] text-[#7A899F]">{label}</p><p className="mt-1.5 truncate text-[10.5px] font-extrabold text-[#203653]">{value}</p></div>;
}

function TimelineStep({ number, label, icon: Icon, tone, status }: { number: number; label: string; icon: LucideIcon; tone: StepTone; status: string }) {
  const toneStyles = {
    complete: "border-[#CDE7D7] bg-[#F3FBF6] text-[#2F7F52]",
    active: "border-[#C9D7FA] bg-[#F2F6FF] text-[#3156B8]",
    pending: "border-[#E1E7F0] bg-[#F8FAFD] text-[#73839A]",
  }[tone];

  return (
    <div className={"relative rounded-2xl border p-4 text-center " + toneStyles}>
      <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-white shadow-sm">
        {tone === "complete" ? <Check className="h-4 w-4" /> : <span className="text-[10px] font-black">{number}</span>}
      </span>
      <Icon className="mx-auto mt-3 h-5 w-5" />
      <p className="mt-2 min-h-[30px] text-[9.5px] font-extrabold leading-4 text-[#203653]">{label}</p>
      <span className="mt-2 inline-flex rounded-lg bg-white px-2 py-1 text-[8.5px] font-bold">{status}</span>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4"><p className="text-[8.5px] font-black uppercase tracking-[0.08em] text-[#7A899F]">{label}</p><p className="mt-1 text-[10.5px] font-extrabold text-[#203653]">{value}</p></div>;
}

function StatusRow({ label, value, complete }: { label: string; value: string; complete: boolean }) {
  return (
    <div className="flex min-h-[52px] items-center gap-3 py-3">
      <span className={"grid h-8 w-8 shrink-0 place-items-center rounded-xl " + (complete ? "bg-[#EAF7EF] text-[#2F7F52]" : "bg-[#F1F4F8] text-[#74839A]")}>
        <ShieldCheck className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 text-[10px] font-bold text-[#203653]">{label}</span>
      <span className="text-[9px] font-semibold text-[#74839A]">{value}</span>
    </div>
  );
}
