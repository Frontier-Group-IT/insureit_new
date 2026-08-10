import Link from "next/link";
import { notFound } from "next/navigation";
import { compactLightActionClassName, primaryActionClassName } from "@/components/action-styles";
import { DocumentVisualCard } from "@/components/document-visual-card";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createIntermediaryPortalLogin } from "@/app/intermediaries/portal-account-actions";
import { resendIntermediaryPortalInvite } from "@/app/intermediaries/resend-portal-invite-action";
import { createLinkedIntermediaryAccount } from "./account-review-actions";
import { IdSuccessModal } from "./id-success-modal";
import { WorkflowSuccessToast } from "../workflow-success-toast";
import { IntermediaryJourneyStep } from "../intermediary-journey-step";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AccountContext = "partner" | "posp" | "misp";
type Application = {
  id: string;
  requested_type: "posp" | "misp";
  final_type: "posp" | "misp" | "partner" | null;
  status: string;
  registration_status: string;
  partner_status: string | null;
  created_at: string;
  updated_at: string;
  draft_data: Record<string, unknown> | null;
  partner_record_id: string | null;
  registration_record_id: string | null;
};
type Profile = {
  partner_id: string | null;
  partner_type: "posp" | "misp";
  external_onboarding_id: string | null;
  pos_name: string | null;
  misp_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  date_of_birth: string | null;
  aadhaar_last_four: string | null;
  pan_number: string | null;
  dp_pan_number: string | null;
  gst_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  oem_name: string | null;
  dp_name: string | null;
  dp_phone: string | null;
  dp_email: string | null;
  dp_date_of_birth: string | null;
  dp_aadhaar_last_four: string | null;
  workflow_stage: string;
  iib_remarks: string | null;
  iib_uploaded: boolean | null;
  iib_uploaded_at: string | null;
  training_status: string | null;
  training_certificate_number: string | null;
  exam_status: string | null;
  onboarding_date: string | null;
  associate_name: string | null;
  document_received_at: string | null;
};
type Assignment = {
  training_status: string;
  training_completed_at: string | null;
  exam_status: string;
  exam_score: number | null;
  exam_completed_at: string | null;
  agreement_status: string;
  agreement_signed_at: string | null;
};
type Document = {
  id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  verification_status: string;
  created_at: string;
};
type Intermediary = {
  id: string;
  intermediary_code: string | null;
  portal_access_status: string;
  account_status: string;
  activated_at: string | null;
};
type LinkedApplication = {
  id: string;
  requested_type: "posp" | "misp";
  registration_status: string;
  draft_data: Record<string, unknown> | null;
  updated_at: string;
};
type PanJob = {
  status: string;
  result_code: string | null;
  result_message: string | null;
  last_error: string | null;
};
type JourneyItem = { label: string; done: boolean; active: boolean };
type IconName = "user" | "account" | "id" | "rm" | "portal" | "calendar" | "documents" | "link";

const partnerDocuments = [
  ["aadhaar_front", "Aadhaar Front"],
  ["aadhaar_back", "Aadhaar Back"],
  ["pan_copy", "PAN Copy"],
  ["cancelled_cheque", "Cancelled Cheque"],
  ["photograph", "Photograph"],
  ["education_10th_marksheet", "Education Marksheet"],
  ["education_12th_marksheet", "Education Marksheet"],
  ["education_graduation_marksheet", "Education Marksheet"],
  ["education_post_graduation_marksheet", "Education Marksheet"],
] as const;
const modalSuccessEvents = new Set(["partner_id_generated", "documents_saved", "linked_posp_account_created", "linked_misp_account_created", "legacy_intermediary_imported"]);

export default async function IntermediaryAccountReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  await requirePospMispManager();
  const admin = createSupabaseAdminClient();

  const [{ data: application }, { data: profile }, { data: assignment }, { data: documents }, { data: intermediary }, { data: panJob }] = await Promise.all([
    admin.from("intermediary_onboarding_applications").select("id,requested_type,final_type,status,registration_status,partner_status,created_at,updated_at,draft_data,partner_record_id,registration_record_id").eq("id", id).maybeSingle<Application>(),
    admin.from("posp_misp_onboarding_profiles").select("partner_id,partner_type,external_onboarding_id,pos_name,misp_name,applicant_phone,applicant_email,date_of_birth,aadhaar_last_four,pan_number,dp_pan_number,gst_number,address,city,state,postal_code,bank_name,bank_account_number,bank_ifsc_code,oem_name,dp_name,dp_phone,dp_email,dp_date_of_birth,dp_aadhaar_last_four,workflow_stage,iib_remarks,iib_uploaded,iib_uploaded_at,training_status,training_certificate_number,exam_status,onboarding_date,associate_name,document_received_at").eq("application_id", id).maybeSingle<Profile>(),
    admin.from("intermediary_training_exam_assignments").select("training_status,training_completed_at,exam_status,exam_score,exam_completed_at,agreement_status,agreement_signed_at").eq("application_id", id).maybeSingle<Assignment>(),
    admin.from("intermediary_onboarding_documents").select("id,document_type,file_name,storage_bucket,storage_path,verification_status,created_at").eq("application_id", id).order("created_at").returns<Document[]>(),
    admin.from("intermediaries").select("id,intermediary_code,portal_access_status,account_status,activated_at").eq("application_id", id).maybeSingle<Intermediary>(),
    admin.from("pan_verification_jobs").select("status,result_code,result_message,last_error").eq("application_id", id).maybeSingle<PanJob>(),
  ]);
  if (!application || !profile) notFound();

  const draft = asObject(application.draft_data);
  const accountContext = (draft.account_context === "posp" || draft.account_context === "misp" ? draft.account_context : "partner") as AccountContext;
  const isPartner = accountContext === "partner";
  const activePartner = application.partner_status === "active_partner";
  const isMisp = accountContext === "misp";
  const kind = isMisp ? "MISP" : "POSP";
  const name = (profile.partner_type === "misp" ? profile.misp_name : profile.pos_name) ?? "Unnamed applicant";
  const partnerId = profile.partner_id && !profile.partner_id.startsWith("PENDING-") ? profile.partner_id : null;
  const issuedRegistrationCode = intermediary?.intermediary_code && !intermediary.intermediary_code.startsWith("PART-") && !intermediary.intermediary_code.startsWith("PENDING-") ? intermediary.intermediary_code : null;
  const profileRegistrationCode = profile.external_onboarding_id && !profile.external_onboarding_id.startsWith("PENDING-") ? profile.external_onboarding_id : null;
  const registrationId = !isPartner ? issuedRegistrationCode ?? profileRegistrationCode : null;
  const phone = profile.partner_type === "misp" ? profile.dp_phone ?? profile.applicant_phone : profile.applicant_phone;
  const email = profile.partner_type === "misp" ? profile.dp_email ?? profile.applicant_email : profile.applicant_email;
  const aadhaar = profile.partner_type === "misp" ? profile.dp_aadhaar_last_four : profile.aadhaar_last_four;
  const verificationPan = (profile.partner_type === "misp" ? profile.dp_pan_number : profile.pan_number)?.replace(/\s/g, "").toUpperCase() ?? null;

  const { data: related } = application.partner_record_id
    ? await admin.from("intermediary_onboarding_applications").select("id,requested_type,registration_status,draft_data,updated_at").eq("partner_record_id", application.partner_record_id).neq("id", id).order("created_at", { ascending: false }).returns<LinkedApplication[]>()
    : { data: [] as LinkedApplication[] };
  const linked = (related ?? []).find((row) => {
    const context = asObject(row.draft_data).account_context;
    return context === "posp" || context === "misp";
  }) ?? null;
  const parentApplication = !isPartner
    ? (related ?? []).find((row) => {
        const context = asObject(row.draft_data).account_context;
        return context !== "posp" && context !== "misp";
      }) ?? null
    : null;
  const { data: linkedIntermediary } = linked
    ? await admin.from("intermediaries").select("id,intermediary_code,portal_access_status,account_status,activated_at").eq("application_id", linked.id).maybeSingle<Intermediary>()
    : { data: null as Intermediary | null };

  const linkedType = linked ? linkedAccountType(linked) : profile.partner_type;
  const linkedAccountId = permanentCode(linkedIntermediary?.intermediary_code) ?? "Not Created";
  const linkedAccountStatus = linked ? pretty(linked.registration_status) : "Not Created";
  const activationDate = intermediary?.activated_at;
  const journey = isPartner ? partnerJourney(profile, documents ?? [], activePartner) : registrationJourney(accountContext, profile, assignment, application);
  const onboardingComplete = isPartner ? activePartner : application.registration_status === "iib_registered" || Boolean(profile.iib_uploaded || profile.iib_uploaded_at);
  const accountActivated = isPartner ? activePartner : application.registration_status === "iib_registered";
  const returnPath = `/intermediaries/applications/${id}`;
  const accountType = isPartner ? (profile.partner_type === "misp" ? "Business Partner" : "Individual Partner") : `${kind} account`;

  const stats = isPartner
    ? [
        { icon: "account" as IconName, label: "Account type", value: accountType },
        { icon: "link" as IconName, label: `${linkedType.toUpperCase()} ID`, value: linkedAccountId, href: linked && linkedAccountId !== "Not Created" ? `/intermediaries/applications/${linked.id}` : undefined, showViewIcon: Boolean(linked && linkedAccountId !== "Not Created") },
        { icon: "id" as IconName, label: "Linked Account Status", value: linkedAccountStatus },
        { icon: "rm" as IconName, label: "Assigned RM", value: profile.associate_name ?? "Not assigned" },
        { icon: "portal" as IconName, label: "Portal Access", value: activePartner ? portalAccessLabel(intermediary?.portal_access_status) : "Available after activation", portalAction: activePartner ? portalAccessAction(intermediary?.portal_access_status) : undefined, intermediaryId: activePartner ? intermediary?.id : undefined, returnPath },
        { icon: "calendar" as IconName, label: "Activation Date", value: date(activationDate) },
      ]
    : [
        { icon: "account" as IconName, label: "Account Type", value: accountType },
        { icon: "id" as IconName, label: "Account Status", value: intermediary?.account_status ? pretty(intermediary.account_status) : "Under Onboarding" },
        { icon: "link" as IconName, label: "Parent Partner", value: partnerId ?? "Pending", href: parentApplication ? `/intermediaries/applications/${parentApplication.id}` : undefined },
        { icon: "rm" as IconName, label: "Assigned RM", value: profile.associate_name ?? "Not assigned" },
        { icon: "portal" as IconName, label: "Portal Access", value: portalAccessLabel(intermediary?.portal_access_status), portalAction: portalAccessAction(intermediary?.portal_access_status), intermediaryId: intermediary?.id, returnPath },
        { icon: "calendar" as IconName, label: "Activation Date", value: accountActivated ? date(intermediary?.activated_at) : "-" },
      ];

  return (
    <AppShell title={`${isPartner ? "Partner" : kind} Account Review`}>
      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
        <IdSuccessModal event={query.success} applicationId={id} isPartner={isPartner} preferredType={profile.partner_type} partnerId={partnerId} registrationId={registrationId} linkedId={linked?.id} />
        {query.error ? <Notice tone="error" text={decode(query.error)} /> : null}
        {query.success && !modalSuccessEvents.has(query.success) ? <WorkflowSuccessToast message={successMessage(query.success)} durationMs={4000} /> : null}

        <section className="overflow-hidden rounded-2xl border border-[#173E7B] bg-gradient-to-br from-[#071D49] via-[#0A2B65] to-[#0C4A9A] text-white shadow-[0_18px_45px_rgba(7,29,73,.18)]">
          <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[#315FEA] shadow-md"><Icon name="user" className="h-6 w-6" /></span>
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-2xl font-semibold">{name}</h1>{isPartner && partnerId ? <Id value={partnerId} active={activePartner} /> : null}{registrationId ? <Id value={registrationId} active={onboardingComplete} /> : null}</div></div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isPartner ? (
                activePartner && !linked ? (
                  <form action={createLinkedIntermediaryAccount}>
                    <input type="hidden" name="application_id" value={id} />
                    <input type="hidden" name="registration_type" value={profile.partner_type} />
                    <CompactSubmit label={profile.partner_type === "misp" ? "Create MISP ID" : "Create POSP ID"} pendingLabel={profile.partner_type === "misp" ? "Creating MISP ID…" : "Creating POSP ID…"} />
                  </form>
                ) : null
              ) : <CompactLink href={`/intermediaries/applications/${id}/workflow?stage=${stageFor(profile)}`} label={`Manage ${kind} account`} />}
              {isPartner ? <Link href={`/intermediaries/applications/${id}/workflow?stage=primary`} aria-label="Edit details" title="Edit details" className={`${compactLightActionClassName} h-9 w-9 px-0`}><PencilIcon /></Link> : null}
            </div>
          </div>
          <div className="grid border-t border-white/15 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{stats.map((stat) => <HeaderStat key={stat.label} {...stat} />)}</div>
        </section>

        <section id="overview" className={!isPartner && !onboardingComplete ? "-mt-2 space-y-4" : "space-y-4"}>
          {!onboardingComplete ? <JourneyCard title={isPartner ? "Partner onboarding journey" : `${kind} account journey`} journey={journey} /> : null}
          {!activePartner && isPartner ? (
            <section className="overflow-hidden rounded-2xl border border-[#C7D2FE] bg-gradient-to-r from-[#EEF2FF] via-white to-[#EFF6FF] shadow-[0_12px_28px_rgba(79,70,229,.10)]">
              <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#4F46E5] text-white shadow-[0_8px_18px_rgba(79,70,229,.22)]"><Icon name="documents" className="h-4.5 w-4.5" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[12.5px] font-semibold text-[#17203A]">Partner documents pending</h2>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[.05em] text-amber-700">Action required</span>
                    </div>
                    <p className="mt-0.5 text-[10px] font-medium text-[#64748B]">Upload Aadhaar, PAN, bank proof and photograph. Add the GST certificate when the Partner is GST-registered.</p>
                  </div>
                </div>
                <Link href={`/intermediaries/applications/${id}/workflow?stage=documents`} className={`${primaryActionClassName} h-9 shrink-0 rounded-xl px-4 text-[10px]`}>Complete documents</Link>
              </div>
            </section>
          ) : null}
        </section>

        <section id="details" className="grid gap-4 lg:grid-cols-2">
          <Card title="Identity and contact"><dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2"><Info label="Name" value={name} /><Info label="PAN" value={maskPan(profile.pan_number)} /><Info label="Aadhaar" value={maskAadhaar(aadhaar)} /><Info label="Date of birth" value={date(profile.partner_type === "misp" ? profile.dp_date_of_birth : profile.date_of_birth)} /><Info label="Mobile" value={phone ?? "-"} /><Info label="Email" value={email ?? "-"} />{profile.partner_type === "misp" ? <><Info label="Designated person" value={profile.dp_name ?? "-"} /><Info label="OEM" value={profile.oem_name ?? "-"} /></> : null}</dl></Card>
          <Card title="Address, bank and tax"><dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2"><Info label="Address" value={completeAddress(profile)} /><Info label="PIN code" value={profile.postal_code ?? "-"} /><Info label="Bank" value={profile.bank_name ?? "-"} /><Info label="Account" value={maskAccount(profile.bank_account_number)} /><Info label="IFSC" value={profile.bank_ifsc_code ?? "-"} /><Info label="GST" value={profile.gst_number ?? "Not applicable"} /></dl></Card>
        </section>

        <section id="documents"><DocumentsCard><DocumentChecklist documents={documents ?? []} /></DocumentsCard></section>
      </div>
    </AppShell>
  );
}

function linkedAccountType(app: LinkedApplication) { const context = asObject(app.draft_data).account_context; return context === "misp" ? "misp" : context === "posp" ? "posp" : app.requested_type; }
function permanentCode(value: string | null | undefined) { const code = value?.trim(); return code && !code.startsWith("PENDING-") && !code.startsWith("PART-") ? code : null; }
function completeAddress(profile: Profile) { const parts = [profile.address, profile.city, profile.state].map((value) => value?.trim()).filter((value): value is string => Boolean(value)); return parts.length ? parts.join(", ") : "-"; }
function partnerJourney(profile: Profile, docs: Document[], activePartner: boolean): JourneyItem[] { const primary = profile.workflow_stage !== "pre_iib" || Boolean(profile.partner_id); const types = new Set(docs.map((item) => item.document_type)); const complete = activePartner || ["aadhaar_front", "pan_copy", "cancelled_cheque"].every((type) => types.has(type)); return [{ label: "Primary details", done: primary, active: !primary }, { label: "Partner documents", done: complete, active: primary && !complete }]; }
function registrationJourney(_context: AccountContext, profile: Profile, assignment: Assignment | null, app: Application): JourneyItem[] {
  const trainingAndExam = assignment?.training_status === "completed" && assignment?.exam_status === "passed";
  const agreement = assignment?.agreement_status === "signed";
  const iibUploaded = Boolean(profile.iib_uploaded || profile.iib_uploaded_at || app.registration_status === "iib_registered");

  return [
    { label: "Primary details", done: true, active: false },
    { label: "Documents", done: true, active: false },
    { label: "Registration", done: true, active: false },
    { label: "Training & Exam", done: trainingAndExam, active: !trainingAndExam },
    { label: "Agreement", done: agreement, active: trainingAndExam && !agreement },
    { label: "IIB Upload", done: iibUploaded, active: agreement && !iibUploaded },
  ];
}
function stageFor(profile: Profile) { return profile.workflow_stage === "pre_iib" ? "primary" : profile.workflow_stage === "iib_processing" ? "documents" : "review"; }
function DocumentChecklist({ documents }: { documents: Document[] }) {
  const education = documents.find((document) => document.document_type.startsWith("education_"));
  const ordered: Array<{ key: string; type: string; label: string; document: Document }> = [];
  const used = new Set<string>();
  const add = (key: string, type: string, label: string, document: Document | undefined) => {
    if (!document || used.has(document.id)) return;
    used.add(document.id);
    ordered.push({ key, type, label, document });
  };

  for (const [type, label] of partnerDocuments.filter(([type]) => !type.startsWith("education_"))) {
    add(type, type, label, documents.find((document) => document.document_type === type));
  }
  add("education", "education", "Education Marksheet", education);
  add(
    "signed_registration_form",
    "signed_registration_form",
    "Signed Registration Certificate",
    documents.find((document) => document.document_type === "signed_registration_form"),
  );

  documents
    .filter((document) => document.document_type.startsWith("custom_"))
    .forEach((document) => add(document.id, document.document_type, "Other Document", document));

  documents
    .filter((document) => !document.document_type.startsWith("education_") && !document.document_type.startsWith("custom_"))
    .forEach((document) => add(document.id, document.document_type, pretty(document.document_type), document));

  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{ordered.map((item) => <DocumentStatus key={item.key} type={item.type} label={item.label} document={item.document} />)}</div>;
}
function DocumentStatus({ type, label, document }: { type: string; label: string; document?: Document }) {
  return <DocumentVisualCard type={type} title={label} fileName={document?.file_name} required={type !== "photograph" && type !== "education"} tone={document ? "uploaded" : type === "photograph" || type === "education" ? "optional" : "required"} status={document ? "Uploaded" : type === "photograph" || type === "education" ? "Optional" : "Missing"} meta={document ? date(document.created_at) : "Awaiting upload"} compact action={document ? <a href={`/intermediaries/applications/documents/${document.id}/open`} target="_blank" rel="noreferrer" aria-label={`View ${label}`} title={`View ${label}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#D7DDF0] bg-white text-[#0F2A55] shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition hover:border-[#B8C7DE] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7D2FE]"><EyeIcon /></a> : null} />;
}
function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-white/75" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </svg>
  );
}
function DocumentsCard({ children }: { children: React.ReactNode }) { return <section className="rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-[#E1E7FF] bg-[#F1F4FF] text-[#4F46E5]"><Icon name="documents" className="h-4.5 w-4.5" /></span><div><h2 className="text-[13px] font-semibold text-[#17203A]">Documents</h2><p className="mt-0.5 text-[9.5px] font-medium text-[#64748B]">Visual checklist for uploaded identity, bank and qualification files.</p></div></div>{children}</section>; }
function Card({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) { return <section className="rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-[13px] font-semibold">{title}</h2>{typeof count === "number" ? <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[9px] font-semibold text-[#4338CA]">{count}</span> : null}</div>{children}</section>; }
type PortalAccessAction = "create_user" | "resend_link";
function HeaderStat({ icon, label, value, href, showViewIcon = false, portalAction, intermediaryId, returnPath }: { icon: IconName; label: string; value: string; href?: string; showViewIcon?: boolean; portalAction?: PortalAccessAction; intermediaryId?: string; returnPath?: string }) {
  const isInteractive = Boolean(href || (portalAction && intermediaryId && returnPath));
  const portalActionNode = portalAction && intermediaryId && returnPath ? (
    <form action={portalAction === "create_user" ? createIntermediaryPortalLogin : resendIntermediaryPortalInvite} className="mt-0.5 leading-none">
      <input type="hidden" name="intermediary_id" value={intermediaryId} />
      <input type="hidden" name="return_path" value={returnPath} />
      <FormSubmitButton label={value} pendingLabel={portalAction === "create_user" ? "Creating…" : "Sending…"} className="h-auto min-h-0 cursor-pointer p-0 text-[10.5px] font-semibold leading-[1.15] text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline" />
    </form>
  ) : null;
  return <div className={`group flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 transition-all duration-150 xl:border-r xl:last:border-r-0 ${isInteractive ? "bg-white/[0.01] ring-1 ring-inset ring-transparent hover:bg-white/[0.07] hover:ring-white/15 focus-within:bg-white/[0.07] focus-within:ring-white/20" : ""}`}><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white transition-all duration-150 ${isInteractive ? "group-hover:border-white/30 group-hover:bg-white/15 group-focus-within:border-white/30 group-focus-within:bg-white/15" : ""}`}><Icon name={icon} className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-1.5"><p className="truncate text-[8px] font-semibold uppercase leading-none tracking-[.05em] text-white/60">{label}</p>{href && showViewIcon ? <Link href={href} aria-label={`View ${label} application`} className="inline-flex shrink-0 cursor-pointer text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"><EyeIcon /></Link> : null}</div>{portalActionNode ?? (href ? <Link href={href} className="mt-0.5 block cursor-pointer truncate text-[10.5px] font-semibold leading-[1.15] text-white underline-offset-2 transition hover:text-[#C7D2FE] hover:underline">{value}</Link> : <p className="mt-0.5 truncate text-[10.5px] font-semibold leading-[1.15] text-white">{value}</p>)}</div></div>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="flex min-w-0 items-baseline gap-1.5 text-[10.5px] leading-5"><dt className="shrink-0 font-semibold text-[#64748B]">{label}:</dt><dd className="min-w-0 break-words font-semibold text-[#0F172A]">{value}</dd></div>; }
function Id({ value, active = false }: { value: string; active?: boolean }) { return <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold">{value}{active ? <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-500 text-white"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5" aria-hidden="true"><path d="M3.5 8.5 6.5 11 12.5 5" /></svg></span> : null}</span>; }
function CompactLink({ href, label, secondary = false }: { href: string; label: string; secondary?: boolean }) { return <Link href={href} className={secondary ? compactLightActionClassName : `${primaryActionClassName} h-9 px-4`}>{label}</Link>; }
function CompactSubmit({ label, pendingLabel, secondary = false }: { label: string; pendingLabel: string; secondary?: boolean }) {
  return <FormSubmitButton
    label={label}
    pendingLabel={pendingLabel}
    className={secondary ? compactLightActionClassName : `${primaryActionClassName} h-9 px-4`}
  />;
}
function JourneyCard({ title, journey }: { title: string; journey: JourneyItem[] }) {
  const detailedStatus = journey.length === 6;
  return (
    <section className={`overflow-x-auto bg-transparent px-0 ${detailedStatus ? "py-0" : "py-1"}`}>
      {!detailedStatus ? <h2 className="mb-4 text-[13px] font-semibold text-[#17203A]">{title}</h2> : null}
      <div className={`relative grid gap-0 ${detailedStatus ? "min-w-[900px] sm:grid-cols-6" : "min-w-[720px] sm:min-w-0 sm:grid-cols-2 before:absolute before:left-[25%] before:right-[25%] before:top-[21px] before:h-px before:bg-[#D6DEE9] before:content-['']"}`}>
        {journey.map((item, index) => <Journey key={item.label} {...item} index={index} detailedStatus={detailedStatus} />)}
      </div>
    </section>
  );
}
function Journey({ label, done, active, index, detailedStatus }: JourneyItem & { index: number; detailedStatus: boolean }) {
  if (detailedStatus) {
    return <IntermediaryJourneyStep label={label} completed={done} active={active} index={index} />;
  }
  return (
    <div className="relative z-[1] min-w-0 text-center">
      <div className={`mx-auto grid h-11 w-11 place-items-center rounded-full border text-[12px] font-bold shadow-[0_0_0_7px_#F8FAFC] ${done ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#0B275B] bg-[#0B275B] text-white" : "border-[#D7E0EB] bg-[#F1F5F9] text-[#94A3B8]"}`}>{done ? "✓" : index + 1}</div>
      <p className={`mt-2 text-[11px] font-semibold ${done ? "text-emerald-800" : active ? "text-[#0B275B]" : "text-[#24345A]"}`}>{label}</p>
    </div>
  );
}
function Notice({ tone, text }: { tone: "error" | "success"; text: string }) { return <div className={`rounded-xl border px-4 py-3 text-[10.5px] ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{text}</div>; }
function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) { const paths: Record<IconName, React.ReactNode> = { user: <><circle cx="12" cy="8" r="3" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>, account: <><circle cx="12" cy="12" r="9" /><path d="M8 15c1-2.5 7-2.5 8 0M12 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" /></>, id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M6 16c.8-1.8 3.2-1.8 4 0M13 10h5M13 14h5" /></>, rm: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M17 8v6M14 11h6" /></>, portal: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8M13 9l3 3-3 3" /></>, calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01" /></>, documents: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v5h5M9 13h6M9 17h6" /></>, link: <><path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" /></> }; return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>; }
function portalLabel(value: string | undefined) { if (value === "invited") return "Portal User Invited"; if (value === "active") return "Portal User Active"; if (value === "suspended") return "Portal User Suspended"; return "Portal User Not Created"; }
function portalAccessLabel(value: string | undefined) { if (value === "not_created" || !value) return "Create User"; if (value === "invited") return "Resend Link"; if (value === "active") return "Active"; if (value === "suspended") return "Suspended"; return pretty(value); }
function portalAccessAction(value: string | undefined): PortalAccessAction | undefined { if (value === "not_created" || !value) return "create_user"; if (value === "invited") return "resend_link"; return undefined; }
function pretty(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function maskPan(value: string | null) { return value && value.length >= 7 ? `${value.slice(0, 2).toUpperCase()}****${value.slice(-3).toUpperCase()}` : "Not available"; }
function maskAadhaar(value: string | null | undefined) { return value ? `**** ${value.slice(-4)}` : "Not available"; }
function maskAccount(value: string | null) { return value ? `•••• ${value.slice(-4)}` : "Not available"; }
function asObject(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function decode(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
function successMessage(value: string) { if (value === "portal_login_invited") return "Portal user created and invitation sent."; if (value === "portal_invite_resent") return "Portal login link resent."; if (value === "pan_verification_requeued") return "PAN recheck added to the IIB queue."; if (value.startsWith("linked_")) return "Linked account application created."; return "Action completed successfully."; }
function date(value: string | null | undefined) { if (!value) return "-"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(parsed); }
