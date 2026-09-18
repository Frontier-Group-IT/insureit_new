import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  IdCard,
  Link2,
  LogIn,
  UserRound,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerIcallLauncher } from "@/components/partner-portal/partner-icall-launcher";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebRegistrationOverview } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function humanize(value: string | null | undefined) {
  return (value || "not recorded").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isComplete(value: string | null | undefined) {
  const normalized = (value || "").toLowerCase();
  return ["active", "approved", "completed", "complete", "passed", "registered", "signed", "iib_registered"].includes(normalized);
}

function trainingButtonLabel(trainingStatus: string, examStatus: string) {
  if (examStatus === "passed") return "View completion status";
  if (examStatus === "failed") return "Reattempt examination";
  if (trainingStatus === "completed" && examStatus !== "not_allotted") return "Go to examination";
  if (["opened", "in_progress"].includes(trainingStatus)) return "Continue training";
  return "Start training";
}

function documentTitle(documentType: string | null, fileName: string | null) {
  const type = documentType?.trim();
  if (type) return humanize(type);
  if (fileName) return fileName.replace(/\.[^.]+$/, "");
  return "Document";
}

function fileSizeLabel(value: number | null) {
  if (!value || value <= 0) return "";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatActivationDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

export default async function PartnerRegistrationPage() {
  const data = await getPartnerWebRegistrationOverview();
  const assignment = data.assignment;
  const qualification = data.qualification_application;
  const intermediaryType = data.intermediary.intermediary_type;
  const registrationStatus = qualification?.registration_status || data.primary_application.registration_status || "primary_pending";
  const trainingStatus = assignment?.training_status || "not_assigned";
  const examStatus = assignment?.exam_status || "not_allotted";
  const agreementStatus = assignment?.agreement_status || "not_generated";
  const iibStatus = assignment?.iib_registration_status || registrationStatus;
  const linkedType = qualification?.final_type === "misp" ? "MISP" : qualification?.final_type === "posp" ? "POSP" : "Qualification";
  const linkedId = qualification ? `${linkedType} linked` : "Not linked";
  const active = data.intermediary.account_status === "active" || data.intermediary.portal_access_status === "active";

  const supabase = await createServerSupabaseClient();
  const visibleDocuments = (data.documents ?? []).filter((document) => {
    const type = (document.document_type || "").trim().toLowerCase().replaceAll("_", " ");
    return type !== "other" && type !== "other document" && type !== "others";
  });

  const documents = await Promise.all(
    visibleDocuments.map(async (document) => {
      if (!document.storage_bucket || !document.storage_path) return { ...document, openUrl: null as string | null };
      const { data: signed } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60 * 60);
      return { ...document, openUrl: signed?.signedUrl ?? null };
    }),
  );

  const stats = [
    { icon: UserRound, label: "Account Type", value: intermediaryType === "posp" ? "POSP account" : intermediaryType === "misp" ? "MISP account" : "Partner" },
    { icon: IdCard, label: intermediaryType === "partner" ? `${linkedType} ID` : "Account Status", value: intermediaryType === "partner" ? linkedId : humanize(data.intermediary.account_status) },
    { icon: Link2, label: intermediaryType === "partner" ? "Linked Account Status" : "Parent Partner", value: intermediaryType === "partner" ? (qualification ? humanize(qualification.registration_status) : "Not linked") : "Not linked" },
    { icon: UserRoundPlus, label: "Assigned RM", value: "Not assigned" },
    { icon: LogIn, label: "Portal Access", value: humanize(data.intermediary.portal_access_status) },
    { icon: CalendarDays, label: "Activation Date", value: formatActivationDate(data.intermediary.activated_at) },
  ];

  const lifecycle = [
    { label: "Primary details", complete: Boolean(data.intermediary.display_name && data.intermediary.mobile) },
    { label: "Documents", complete: documents.length > 0 },
    { label: "Registration", complete: isComplete(registrationStatus) || active },
    { label: "Training & Exam", complete: intermediaryType === "partner" || (trainingStatus === "completed" && examStatus === "passed") },
    { label: "Agreement", complete: intermediaryType === "partner" || isComplete(agreementStatus) },
    { label: "IIB Upload", complete: intermediaryType === "partner" || isComplete(iibStatus) },
  ];

  return (
    <PartnerPortalShell title="Registration">
      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
        <section className="overflow-hidden rounded-2xl border border-[#173E7B] bg-gradient-to-br from-[#071D49] via-[#0A2B65] to-[#0C4A9A] text-white shadow-[0_18px_45px_rgba(7,29,73,.18)]">
          <div className="flex items-center px-5 py-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#315FEA] shadow-md">
                <UserRound className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold">{data.intermediary.display_name}</h1>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold">
                    {data.intermediary.intermediary_code || "Code not recorded"}
                    {active ? <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"><Check className="h-2.5 w-2.5" /></span> : null}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid border-t border-white/15 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {stats.map((stat) => <HeaderStat key={stat.label} {...stat} />)}
          </div>
        </section>

        <LifecycleStrip steps={lifecycle} />

        {qualification && assignment ? (
          <div className="flex justify-end">
            <PartnerIcallLauncher buttonLabel={trainingButtonLabel(trainingStatus, examStatus)} accountLabel={linkedType} />
          </div>
        ) : null}

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
              <p className="mt-0.5 text-[9px] text-[#64748B]">{documents.length} attached</p>
            </div>
          </div>

          {documents.length ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {documents.map((document) => {
                const title = documentTitle(document.document_type, document.file_name);
                const meta = [document.mime_type?.includes("pdf") ? "PDF" : document.mime_type?.split("/")[1]?.toUpperCase(), fileSizeLabel(document.file_size)].filter(Boolean).join(" · ");
                const card = (
                  <>
                    <span className="inline-flex w-fit rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[7.5px] font-bold uppercase tracking-[.04em] text-emerald-700">Uploaded</span>
                    <div className="mt-3 flex min-h-[86px] items-center gap-3 rounded-xl bg-white/65 px-4 py-3">
                      <FileText className="h-10 w-10 shrink-0 text-[#3156B8]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-[#17203A]">{title}</p>
                        <p className="mt-1 truncate text-[9px] text-[#64748B]">{meta || document.file_name || "Uploaded document"}</p>
                      </div>
                      {document.openUrl ? <ArrowRight className="h-4 w-4 shrink-0 text-[#3156B8] transition group-hover:translate-x-0.5" /> : null}
                    </div>
                  </>
                );

                return document.openUrl ? (
                  <a
                    key={document.id}
                    href={document.openUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${title}`}
                    className="group block rounded-2xl border border-emerald-200 bg-gradient-to-br from-[#F7FAFF] via-[#EEF4FF] to-[#EAF0F8] p-3 transition hover:border-[#7CC9A9] hover:shadow-[0_8px_20px_rgba(49,86,184,.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25"
                  >
                    {card}
                  </a>
                ) : (
                  <div key={document.id} className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-[#F7FAFF] via-[#EEF4FF] to-[#EAF0F8] p-3">
                    {card}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-[#D9E2F0] px-4 py-6 text-center text-[10px] font-medium text-[#718096]">No documents available.</p>
          )}
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

function LifecycleStrip({ steps }: { steps: Array<{ label: string; complete: boolean }> }) {
  const firstPending = steps.findIndex((step) => !step.complete);
  return (
    <section className="overflow-x-auto px-1 py-1">
      <div className="flex min-w-[980px] items-center justify-between gap-3">
        {steps.map((step, index) => {
          const current = index === firstPending;
          return (
            <div key={step.label} className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
                <span className={`truncate text-[11px] font-semibold ${step.complete ? "text-emerald-700" : current ? "text-[#173E7B]" : "text-[#64748B]"}`}>{step.label}</span>
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold ${step.complete ? "bg-emerald-600 text-white" : current ? "bg-[#173E7B] text-white" : "border border-[#D6DFEC] bg-[#F3F6FA] text-[#94A3B8]"}`}>
                  {step.complete ? <Check className="h-3 w-3" /> : index + 1}
                </span>
              </div>
              {index < steps.length - 1 ? <span className="h-px w-8 shrink-0 bg-[#D6DFEC]" /> : null}
            </div>
          );
        })}
      </div>
    </section>
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
