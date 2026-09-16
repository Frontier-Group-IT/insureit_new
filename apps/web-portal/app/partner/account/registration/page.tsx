import {
  BadgeCheck,
  CalendarDays,
  Check,
  ClipboardCheck,
  Eye,
  FileText,
  IdCard,
  Link2,
  LogIn,
  Pencil,
  UserRound,
  UserRoundPlus,
  type LucideIcon,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
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
  const reviewTitle = intermediaryType === "posp" ? "POSP Application Review" : intermediaryType === "misp" ? "MISP Application Review" : "Partner Application Review";

  const stats = [
    { icon: UserRound, label: "Account Type", value: intermediaryType === "posp" ? "POSP account" : intermediaryType === "misp" ? "MISP account" : "Partner" },
    { icon: IdCard, label: intermediaryType === "partner" ? `${linkedType} ID` : "Account Status", value: intermediaryType === "partner" ? linkedId : humanize(data.intermediary.account_status) },
    { icon: Link2, label: intermediaryType === "partner" ? "Linked Account Status" : "Parent Partner", value: intermediaryType === "partner" ? (qualification ? humanize(qualification.registration_status) : "Not linked") : (data.intermediary.partner_code || "Not linked") },
    { icon: UserRoundPlus, label: "Assigned RM", value: "Not assigned" },
    { icon: LogIn, label: "Portal Access", value: humanize(data.intermediary.portal_access_status) },
    { icon: CalendarDays, label: "Activation Date", value: "-" },
  ];

  const lifecycle = [
    { label: "Primary details", complete: Boolean(data.intermediary.display_name && data.intermediary.mobile) },
    { label: "Documents", complete: data.document_count > 0 },
    { label: "Registration", complete: isComplete(registrationStatus) || active },
    { label: "Training & Exam", complete: intermediaryType === "partner" || (trainingStatus === "completed" && examStatus === "passed") },
    { label: "Agreement", complete: intermediaryType === "partner" || isComplete(agreementStatus) },
    { label: "IIB Upload", complete: intermediaryType === "partner" || isComplete(iibStatus) },
  ];

  const documentLabels = intermediaryType === "partner"
    ? ["Business Registration", "PAN Card", "Aadhaar Card", "Bank Account Proof", "GST Certificate", "Other Document"]
    : ["Aadhaar Front", "Aadhaar Back", "PAN Copy", "Cancelled Cheque", "Photograph", "Other Document"];

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
                <h1 className="truncate text-xl font-semibold">{reviewTitle}</h1>
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

        <LifecycleStrip steps={lifecycle} />

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

          <div className="mt-4 overflow-x-auto pb-1">
            <div className="grid min-w-[1050px] grid-cols-6 gap-3">
              {documentLabels.map((label, index) => (
                <DocumentCard key={label} label={label} uploaded={index < Math.min(data.document_count, 6)} />
              ))}
            </div>
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

function DocumentCard({ label, uploaded }: { label: string; uploaded: boolean }) {
  return (
    <div className={`relative min-h-[170px] overflow-hidden rounded-2xl border p-3 ${uploaded ? "border-emerald-200 bg-gradient-to-br from-[#F7FAFF] via-[#EEF4FF] to-[#EAF0F8]" : "border-[#D8E3F2] bg-[#F8FAFD]"}`}>
      <span className={`inline-flex rounded-full border px-2 py-1 text-[7.5px] font-bold uppercase tracking-[.04em] ${uploaded ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#D8E3F2] bg-white text-[#64748B]"}`}>
        {uploaded ? "Uploaded" : "Pending"}
      </span>
      <div className="mt-3 flex h-[82px] items-center justify-center rounded-xl bg-white/55">
        <FileText className={`h-12 w-12 ${uploaded ? "text-[#4F6EA8]/55" : "text-[#94A3B8]/40"}`} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="truncate text-[9.5px] font-semibold text-[#17203A]">{label}</p>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-[#315FEA] shadow-sm"><Eye className="h-3.5 w-3.5" /></span>
      </div>
    </div>
  );
}
