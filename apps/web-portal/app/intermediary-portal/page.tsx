import { redirect } from "next/navigation";
import {
  Building2,
  ChevronRight,
  ClipboardCheck,
  FilePenLine,
  Files,
  GraduationCap,
  Handshake,
  IdCard,
  LockKeyhole,
  Mail,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { BrandLockup } from "@/components/brand-lockup";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { IntermediaryLogoutButton } from "./logout-button";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PortalAccount = { intermediary_id: string; application_id: string | null; status: string };
type Intermediary = {
  id: string;
  display_name: string;
  intermediary_type: "posp" | "misp" | "partner";
  mobile: string | null;
  email: string | null;
  account_status: string;
  portal_access_status: string;
};
type Application = { registration_status: string; status: string };
type Assignment = {
  training_title: string | null;
  training_url: string | null;
  training_instructions: string | null;
  training_deadline: string | null;
  training_status: string;
  exam_status: string;
  agreement_status: string;
};

type StepTone = "complete" | "active" | "pending";

export default async function IntermediaryPortalPage() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || profile.role !== "intermediary" || !profile.is_active) redirect("/access-denied");

  const admin = createSupabaseAdminClient();
  const { data: account } = await admin
    .from("intermediary_portal_accounts")
    .select("intermediary_id,application_id,status")
    .eq("auth_user_id", profile.id)
    .maybeSingle<PortalAccount>();
  if (!account || account.status === "disabled") redirect("/access-denied");

  const [{ data: intermediary }, { data: application }, { data: assignment }, { count: documentCount }] = await Promise.all([
    admin.from("intermediaries").select("id,display_name,intermediary_type,mobile,email,account_status,portal_access_status").eq("id", account.intermediary_id).maybeSingle<Intermediary>(),
    account.application_id
      ? admin.from("intermediary_onboarding_applications").select("registration_status,status").eq("id", account.application_id).maybeSingle<Application>()
      : Promise.resolve({ data: null }),
    account.application_id
      ? admin.from("intermediary_training_exam_assignments").select("training_title,training_url,training_instructions,training_deadline,training_status,exam_status,agreement_status").eq("application_id", account.application_id).maybeSingle<Assignment>()
      : Promise.resolve({ data: null }),
    account.application_id
      ? admin.from("intermediary_onboarding_documents").select("id", { count: "exact", head: true }).eq("application_id", account.application_id)
      : Promise.resolve({ count: 0 }),
  ]);

  if (!intermediary) redirect("/access-denied");

  if (account.status === "invited") {
    const now = new Date().toISOString();
    await Promise.all([
      admin.from("intermediary_portal_accounts").update({ status: "active", activated_at: now, updated_at: now }).eq("auth_user_id", profile.id),
      admin.from("intermediaries").update({ portal_access_status: "active", updated_at: now }).eq("id", intermediary.id),
    ]);
  }

  const registrationStatus = application?.registration_status ?? "primary_pending";
  const trainingStatus = assignment?.training_status ?? "not_assigned";
  const examStatus = assignment?.exam_status ?? "not_allotted";
  const agreementStatus = assignment?.agreement_status ?? "not_generated";
  const documentsComplete = Boolean(documentCount);
  const trainingComplete = trainingStatus === "completed";
  const trainingActive = !trainingComplete && !["not_assigned", "pending"].includes(trainingStatus);
  const examComplete = examStatus === "passed";
  const agreementComplete = agreementStatus === "signed";
  const iibComplete = registrationStatus === "iib_registered";

  const steps = [
    { label: "Primary information", icon: IdCard, tone: "complete" as StepTone, status: "Completed" },
    { label: `${documentCount ?? 0} documents attached`, icon: Files, tone: documentsComplete ? "complete" as StepTone : "pending" as StepTone, status: documentsComplete ? "Completed" : "Pending" },
    { label: "Training", icon: GraduationCap, tone: trainingComplete ? "complete" as StepTone : trainingActive ? "active" as StepTone : "pending" as StepTone, status: trainingComplete ? "Completed" : trainingActive ? "In Progress" : "Pending" },
    { label: "Examination", icon: ClipboardCheck, tone: examComplete ? "complete" as StepTone : "pending" as StepTone, status: examComplete ? "Completed" : "Pending" },
    { label: "Agreement", icon: FilePenLine, tone: agreementComplete ? "complete" as StepTone : "pending" as StepTone, status: agreementComplete ? "Completed" : "Pending" },
    { label: "IIB registration", icon: Building2, tone: iibComplete ? "complete" as StepTone : "pending" as StepTone, status: iibComplete ? "Completed" : "Pending" },
  ];

  return (
    <main className="min-h-screen bg-[#F3F7FC]">
      <header className="border-b border-[#DCE5EF] bg-white">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-4">
          <BrandLockup size="compact" />
          <IntermediaryLogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-[1240px] space-y-4 px-4 py-6">
        <section className="overflow-hidden rounded-3xl border border-[#17458A] bg-gradient-to-r from-[#071D49] via-[#082D76] to-[#0646A5] text-white shadow-sm">
          <div className="flex flex-col gap-4 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] sm:text-[28px]">{intermediary.display_name}</h1>
              <span aria-hidden="true" className="hidden h-8 w-px bg-white/25 sm:block" />
              <span className="flex min-w-0 items-center gap-2 text-[11px] text-white/85 sm:text-[12px]">
                <Mail className="h-4 w-4 shrink-0" />
                <span className="break-all">{intermediary.email ?? "-"}</span>
              </span>
            </div>
            <StatusPill value={registrationStatus} />
          </div>

          <div className="grid border-t border-white/15 sm:grid-cols-2 lg:grid-cols-5">
            <HeaderMetric icon={UserRound} label="Account" value={intermediary.account_status} tone="sky" />
            <HeaderMetric icon={LockKeyhole} label="Portal access" value="active" tone="emerald" />
            <HeaderMetric icon={GraduationCap} label="Training" value={trainingStatus} tone="indigo" />
            <HeaderMetric icon={ClipboardCheck} label="Examination" value={examStatus} tone="amber" />
            <HeaderMetric icon={Handshake} label="Agreement" value={agreementStatus} tone="violet" />
          </div>
        </section>

        <section className="rounded-3xl border border-[#DCE5EF] bg-white px-5 py-6 shadow-sm sm:px-7">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Your onboarding</h2>
          <div className="relative mt-6">
            <div aria-hidden="true" className="absolute left-[8.5%] right-[8.5%] top-4 hidden border-t-2 border-dotted border-[#CBD5E1] lg:block" />
            <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              {steps.map((step, index) => (
                <TimelineStep key={step.label} number={index + 1} {...step} />
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#DCE5EF] bg-white px-5 py-6 shadow-sm sm:px-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-[.09em] text-[#64748B]">Training material</p>
              <h2 className="mt-1 text-[16px] font-semibold text-[#0F172A]">{assignment?.training_title ?? "Training has not been assigned"}</h2>
              <p className="mt-2 text-[11px] text-[#64748B]">{trainingComplete ? "Training completed successfully." : "Continue learning to complete your training."}</p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
              <span className="text-[10px] font-semibold capitalize text-[#334155]">{trainingStatus.replaceAll("_", " ")}</span>
              {assignment?.training_url ? (
                <a href={assignment.training_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#4F7DF3] bg-white px-5 py-2.5 text-[11px] font-semibold text-[#2456C8] shadow-sm transition hover:bg-[#F4F7FF]">
                  Go to Training <ChevronRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatusPill({ value }: { value: string }) {
  const label = value === "training_in_progress" || value === "training" ? "Training In Progress" : value.replaceAll("_", " ");
  return <span className="inline-flex w-fit rounded-full bg-white/15 px-4 py-2 text-[10px] font-semibold capitalize text-white shadow-inner ring-1 ring-white/10">{label}</span>;
}

function HeaderMetric({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: "sky" | "emerald" | "indigo" | "amber" | "violet" }) {
  const tones = {
    sky: "bg-sky-50 text-sky-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };
  return (
    <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5 last:border-b-0 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(-n+3)]:border-b lg:border-b-0 lg:border-r lg:last:border-r-0">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tones[tone]}`}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <p className="text-[9px] font-semibold uppercase tracking-[.06em] text-white/70">{label}</p>
        <p className="mt-1 text-[11px] font-semibold capitalize text-white">{value.replaceAll("_", " ")}</p>
      </div>
    </div>
  );
}

function TimelineStep({ number, label, icon: Icon, tone, status }: { number: number; label: string; icon: LucideIcon; tone: StepTone; status: string }) {
  const styles = {
    complete: { circle: "bg-emerald-500 text-white", card: "border-emerald-100 bg-emerald-50/70", icon: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700" },
    active: { circle: "bg-blue-600 text-white", card: "border-blue-100 bg-blue-50/70", icon: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
    pending: { circle: "bg-slate-200 text-slate-600", card: "border-[#E2E8F0] bg-[#F8FAFC]", icon: "text-[#44546F]", badge: "bg-slate-200/80 text-slate-600" },
  }[tone];
  return (
    <div className="relative flex min-w-0 flex-col items-center">
      <span className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold shadow-sm ${styles.circle}`}>{tone === "complete" ? "✓" : number}</span>
      <div className={`mt-4 flex min-h-[190px] w-full flex-col items-center justify-center rounded-2xl border px-3 py-5 text-center ${styles.card}`}>
        <Icon className={`h-12 w-12 ${styles.icon}`} strokeWidth={1.6} />
        <p className="mt-4 min-h-[34px] text-[11px] font-semibold leading-4 text-[#17203A]">{label}</p>
        <span className={`mt-3 rounded-lg px-3 py-1.5 text-[9.5px] font-semibold ${styles.badge}`}>{status}</span>
      </div>
    </div>
  );
}
