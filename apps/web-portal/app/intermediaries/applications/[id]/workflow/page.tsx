import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { loadPospMispAssociates } from "@/lib/posp-misp-associates";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { resolveIibPanVerificationStatus, type IibPanVerificationJob } from "@/lib/iib-pan-verification-status";
import { PospMispApplicationEditor, type PospMispEditProfile } from "@/app/customers/applications/posp-misp-application-editor";
import { type PospMispWorkflowProfile } from "@/app/customers/applications/posp-misp-workflow-panel";
import { PanVerificationAutoRefresh } from "@/app/customers/applications/pan-verification-auto-refresh";
import { TrainingExamStage } from "@/app/intermediaries/applications/training-exam-stage";
import { IibSubmissionStage } from "@/app/intermediaries/applications/iib-submission-stage";
import { WorkflowResultDialog } from "@/app/intermediaries/applications/workflow-result-dialog";
import { WorkflowErrorDialog } from "@/app/intermediaries/applications/workflow-error-dialog";
import { WorkflowSuccessToast } from "@/app/intermediaries/applications/workflow-success-toast";
import { IntermediaryDocumentUploadController } from "@/app/intermediaries/applications/intermediary-document-upload-controller";
import { ExistingIntermediaryMigrationEditor } from "../existing-intermediary-migration-editor";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Application = {
  id: string;
  requested_type: "posp" | "misp";
  final_type: "posp" | "misp" | "partner" | null;
  status: string;
  registration_status: string;
  partner_status: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  updated_at: string;
  draft_data: Record<string, unknown> | null;
  partner_record_id: string | null;
};
type Document = { id: string; document_type: string; file_name: string; storage_bucket: string; storage_path: string; verification_status: string };
type ProfileRow = PospMispWorkflowProfile & Omit<PospMispEditProfile, "aadhaar_exists"> & {
  aadhaar_number_encrypted: string | null;
  dp_aadhaar_number_encrypted: string | null;
  dp_aadhaar_last_four: string | null;
  dp_date_of_birth: string | null;
  bank_name: string | null;
  record_source: string;
  existing_registration_confirmed: boolean;
  existing_registration_code: string | null;
  existing_registration_confirmed_at: string | null;
  raw_data: Record<string, unknown> | null;
};
type ViewStage = "primary" | "documents" | "review";
type Assignment = {
  training_title: string | null;
  training_url: string | null;
  training_instructions: string | null;
  training_assigned_at: string | null;
  training_started_at: string | null;
  training_completed_at: string | null;
  training_deadline: string | null;
  training_status: string;
  exam_title: string | null;
  exam_url: string | null;
  passing_percentage: number | null;
  maximum_attempts: number | null;
  exam_duration_minutes: number | null;
  exam_available_from: string | null;
  exam_available_until: string | null;
  exam_allotted_at: string | null;
  exam_completed_at: string | null;
  exam_passed_at: string | null;
  exam_status: string;
  exam_score: number | null;
  exam_attempts_used: number;
  agreement_status: string;
  agreement_signing_url: string | null;
  agreement_sent_at: string | null;
  agreement_opened_at: string | null;
  agreement_signed_at: string | null;
};

const errors: Record<string, string> = {
  partner_activation_failed: "Partner ID could not be issued.",
  stage_locked: "This stage is not currently available.",
  documents_incomplete: "Upload the required documents before completing the document stage.",
  workflow_save_failed: "The process update could not be saved.",
  pan_verification_invalid: "Enter a valid PAN before starting the check.",
  pan_verification_queue_failed: "The PAN check could not be queued.",
  posp_misp_edit_invalid: "Review the required primary information and save again.",
  posp_misp_edit_failed: "The primary information could not be saved.",
  duplicate_aadhaar: "This Aadhaar number is already registered with another intermediary account.",
  duplicate_pan: "This PAN number is already registered with another intermediary account.",
  duplicate_email: "This email address is already registered with another intermediary account.",
  duplicate_mobile: "This mobile number is already registered with another intermediary account.",
};
const successes: Record<string, string> = {
  posp_misp_submitted: "Primary information saved.",
  primary_details_saved: "Stage 1 details saved.",
  documents_saved: "Stage 2 documents saved and Partner ID issued.",
  documents_started: "Document stage opened.",
};
const popupEvents = new Set(["documents_completed", "training_assigned", "training_status_updated", "exam_allotted", "exam_passed", "exam_failed", "agreement_sent", "agreement_signed", "onboarding_completed"]);

export default async function IntermediaryWorkflowPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; success?: string; stage?: string; field?: string }> }) {
  await requirePospMispManager();
  const { id } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  const [{ data: application }, { data: profile }, { data: documents }, { data: panJob }, { data: assignment }] = await Promise.all([
    admin.from("intermediary_onboarding_applications").select("id,requested_type,final_type,status,registration_status,partner_status,applicant_phone,applicant_email,updated_at,draft_data,partner_record_id").eq("id", id).maybeSingle<Application>(),
    admin.from("posp_misp_onboarding_profiles").select("partner_id,partner_type,associate_employee_id,associate_profile_id,external_onboarding_id,document_received_at,pos_name,pos_first_name,pos_middle_name,pos_last_name,misp_name,applicant_phone,applicant_email,date_of_birth,aadhaar_last_four,aadhaar_number_encrypted,pan_number,gst_number,address,city,state,postal_code,bank_id,bank_name,bank_account_number,bank_ifsc_code,oem_name,dp_name,dp_first_name,dp_middle_name,dp_last_name,dp_phone,dp_email,dp_pan_number,dp_date_of_birth,dp_aadhaar_last_four,dp_aadhaar_number_encrypted,workflow_stage,iib_remarks,iib_uploaded,iib_uploaded_at,training_login_id,training_credentials_shared_flag,training_start_date,training_end_date,training_status,training_certificate_number,exam_status,onboarding_date,record_source,existing_registration_confirmed,existing_registration_code,existing_registration_confirmed_at,raw_data").eq("application_id", id).maybeSingle<ProfileRow>(),
    admin.from("intermediary_onboarding_documents").select("id,document_type,file_name,storage_bucket,storage_path,verification_status").eq("application_id", id).order("created_at").returns<Document[]>(),
    admin.from("pan_verification_jobs").select("status,result_code,result_message,last_error").eq("application_id", id).maybeSingle<IibPanVerificationJob>(),
    admin.from("intermediary_training_exam_assignments").select("training_title,training_url,training_instructions,training_assigned_at,training_started_at,training_completed_at,training_deadline,training_status,exam_title,exam_url,passing_percentage,maximum_attempts,exam_duration_minutes,exam_available_from,exam_available_until,exam_allotted_at,exam_completed_at,exam_passed_at,exam_status,exam_score,exam_attempts_used,agreement_status,agreement_signing_url,agreement_sent_at,agreement_opened_at,agreement_signed_at").eq("application_id", id).maybeSingle<Assignment>(),
  ]);
  if (!application || !profile) notFound();

  const [associates, { data: banks }, { data: oems }] = await Promise.all([
    loadPospMispAssociates(admin),
    admin.from("banks").select("id,name").eq("is_active", true).order("name").returns<Array<{ id: string; name: string }>>(),
    admin.from("vehicle_manufacturers").select("name").eq("is_active", true).order("sort_order").order("name").returns<Array<{ name: string }>>(),
  ]);

  const { aadhaar_number_encrypted, dp_aadhaar_number_encrypted, ...safeProfile } = profile;
  const aadhaarEncrypted = profile.partner_type === "misp" ? dp_aadhaar_number_encrypted : aadhaar_number_encrypted;
  const aadhaarLastFour = profile.partner_type === "misp" ? profile.dp_aadhaar_last_four : profile.aadhaar_last_four;
  const editProfile: PospMispEditProfile = {
    ...safeProfile,
    date_of_birth: profile.partner_type === "misp" ? profile.dp_date_of_birth : profile.date_of_birth,
    aadhaar_last_four: aadhaarLastFour,
    aadhaar_exists: Boolean(aadhaarEncrypted),
  };
  const editable = ["submitted", "under_review", "changes_requested"].includes(application.status) || application.partner_status === "active_partner";
  const title = profile.partner_type === "misp" ? (profile.misp_name ?? "MISP application") : (profile.pos_name ?? "POSP application");
  const context = accountContext(application.draft_data);
  const permanentReference = context === "partner" ? profile.partner_id : (profile.external_onboarding_id && !profile.external_onboarding_id.startsWith("PENDING-") ? profile.external_onboarding_id : null);
  const requiredDocumentTypes = ["aadhaar_front", "aadhaar_back", "pan_copy", "cancelled_cheque", "photograph", ...(profile.gst_number ? ["gst_copy"] : [])];
  const uploadedDocumentTypes = new Set((documents ?? []).filter((document) => Boolean(document.file_name?.trim())).map((document) => document.document_type));
  const documentsComplete = requiredDocumentTypes.every((documentType) => uploadedDocumentTypes.has(documentType));
  const shouldRefresh = profile.workflow_stage === "pre_iib" && (!panJob || ["pending", "queued", "checking"].includes(panJob.status ?? ""));
  const unlocked = profile.workflow_stage === "pre_iib" ? ["primary"] : profile.workflow_stage === "iib_processing" ? ["primary", "documents"] : ["primary", "documents", "review"];
  const normalizedError = normalizeWorkflowError(query.error, query.field);
  const requested = (normalizedError.field ? "primary" : query.stage === "primary" || query.stage === "documents" || query.stage === "review" ? query.stage : null) as ViewStage | null;
  const defaultView: ViewStage = profile.workflow_stage === "pre_iib" ? "primary" : profile.workflow_stage === "iib_processing" ? "documents" : "review";
  const viewStage: ViewStage = requested && unlocked.includes(requested) ? requested : defaultView;
  const docList = (documents ?? []).map((item) => ({ document_type: item.document_type, file_name: item.file_name }));
  const popupEvent = query.success && popupEvents.has(query.success) ? query.success : null;
  const verificationPan = (profile.partner_type === "misp" ? profile.dp_pan_number : profile.pan_number)?.replace(/\s/g, "").toUpperCase() ?? null;
  const iibStatus = resolveIibPanVerificationStatus(panJob, profile.iib_remarks);
  const iibCleared = iibStatus.code === "cleared";
  const onboardingComplete = context === "partner"
    ? application.partner_status === "active_partner"
    : application.registration_status === "iib_registered" || Boolean(profile.iib_uploaded || profile.iib_uploaded_at);

  let migrationValues = { ...asObject(profile.raw_data), ...asObject(application.draft_data) };
  if (context !== "partner" && application.partner_record_id) {
    const { data: familyApplications } = await admin
      .from("intermediary_onboarding_applications")
      .select("id,draft_data")
      .eq("partner_record_id", application.partner_record_id)
      .neq("id", id)
      .returns<Array<{ id: string; draft_data: Record<string, unknown> | null }>>();
    const parentApplication = (familyApplications ?? []).find((item) => accountContext(item.draft_data) === "partner");
    if (parentApplication) {
      const { data: parentProfile } = await admin
        .from("posp_misp_onboarding_profiles")
        .select("raw_data")
        .eq("application_id", parentApplication.id)
        .maybeSingle<{ raw_data: Record<string, unknown> | null }>();
      migrationValues = {
        ...migrationValues,
        ...asObject(parentProfile?.raw_data),
        ...asObject(parentApplication.draft_data),
      };
    }
  }

  return (
    <AppShell title="Intermediary Workflow">
      <PanVerificationAutoRefresh enabled={shouldRefresh} />
      <WorkflowResultDialog applicationId={id} event={popupEvent} />
      <WorkflowErrorDialog applicationId={id} message={normalizedError.message} field={normalizedError.field} />
      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
        <section className="rounded-2xl border border-[#DCE5EF] bg-white/80 px-5 py-4 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold text-white">{title}</h1>
              {permanentReference ? <span className="rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 text-[9.5px] font-semibold text-white">{permanentReference}</span> : null}
              {onboardingComplete ? <span className="rounded-full border border-emerald-300/60 bg-emerald-400/20 px-2.5 py-1 text-[9px] font-bold text-emerald-50">✓ Onboarding complete</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[15px] font-semibold tracking-wide text-[#334155]">{maskPan(verificationPan)}</span>
              <span title={iibStatus.detail ?? iibStatus.label} className={`rounded-lg px-3 py-1.5 text-[9.5px] font-semibold ${iibStatus.badgeClassName}`}>{iibStatus.code === "cleared" ? "✓ " : ""}{iibStatus.label}</span>
            </div>
          </div>
        </section>

        {query.success && !popupEvent ? <WorkflowSuccessToast message={successes[query.success] ?? "Saved successfully."} /> : null}

        {!onboardingComplete ? (context === "partner" ? (
          <PartnerTwoStepNavigation applicationId={id} viewStage={viewStage} documentsComplete={documentsComplete} partnerActive={application.partner_status === "active_partner"} />
        ) : (
          <SixStepNavigation applicationId={id} viewStage={viewStage} registrationStatus={application.registration_status} documentsComplete={documentsComplete} agreementSigned={assignment?.agreement_status === "signed"} />
        )) : null}

        <IntermediaryDocumentUploadController applicationId={id} enabled={viewStage === "documents" && editable} showGst={Boolean(profile.gst_number)} />
        <main className="overflow-hidden rounded-2xl border bg-white">
          {viewStage === "review" ? (
            <div className="space-y-5 bg-[#F4F7FB] p-4 [&_#qualification-process>section:first-child>div:first-child]:!bg-none [&_#qualification-process>section:first-child>div:first-child]:!bg-[#F8FAFC] [&_#qualification-process>section:first-child>div:first-child]:!text-[#0F172A] [&_#qualification-process>section:first-child>div:first-child_*]:!text-[#0F172A] [&_#qualification-process>section:first-child>div:first-child_p]:!text-[#64748B]">
              <TrainingExamStage applicationId={id} profile={{ ...editProfile, bank_name: profile.bank_name, aadhaar_number: aadhaarLastFour, training_login_id: profile.training_login_id, training_status: profile.training_status, exam_status: profile.exam_status }} assignment={assignment ?? null} documents={docList} iibVerified={iibCleared} finalType={application.final_type} />
              <IibSubmissionStage applicationId={id} agreementSigned={assignment?.agreement_status === "signed"} finalType={application.final_type} />
            </div>
          ) : (
            <div className="space-y-4 bg-[#F4F7FB]">
              <PospMispApplicationEditor applicationId={id} profile={editProfile} workflowStage={profile.workflow_stage} viewStage={viewStage} editable={editable} salesManagers={associates.map((item) => ({ value: item.id, label: item.full_name ?? "Unnamed" }))} banks={(banks ?? []).map((item) => ({ value: item.id, label: item.name }))} oems={(oems ?? []).map((item) => ({ value: item.name, label: item.name }))} documents={docList} actionTargetId={context === "partner" && viewStage === "primary" ? `partner-primary-actions-${id}` : undefined} />
              {viewStage === "primary" ? <div className="px-4 pb-4 sm:px-5 sm:pb-5"><ExistingIntermediaryMigrationEditor applicationId={id} accountType={profile.partner_type} values={migrationValues} editable={editable} />{context === "partner" ? <div id={`partner-primary-actions-${id}`} className="mt-4" /> : null}</div> : null}
            </div>
          )}
        </main>
      </div>
    </AppShell>
  );
}

function normalizeWorkflowError(raw: string | undefined, field: string | undefined) {
  if (!raw) return { message: null, field: null };
  const decoded = decodeURIComponent(raw);
  const lower = decoded.toLowerCase();
  if (raw === "duplicate_aadhaar" || lower.includes("partner_aadhaar") || lower.includes("aadhaar_uidx")) return { message: errors.duplicate_aadhaar, field: "aadhaar_number" };
  if (raw === "duplicate_pan" || lower.includes("pan_uidx") || lower.includes("duplicate") && lower.includes("pan")) return { message: errors.duplicate_pan, field: "pan_number" };
  if (raw === "duplicate_email" || lower.includes("duplicate") && lower.includes("email")) return { message: errors.duplicate_email, field: "applicant_email" };
  if (raw === "duplicate_mobile" || lower.includes("duplicate") && (lower.includes("mobile") || lower.includes("phone"))) return { message: errors.duplicate_mobile, field: "applicant_phone" };
  return { message: errors[raw] ?? "The requested change could not be saved. Review the entered information and try again.", field: field ?? null };
}

function maskPan(value: string | null) {
  if (!value) return "PAN pending";
  const pan = value.toUpperCase();
  return pan.length >= 7 ? `${pan.slice(0, 2)}****${pan.slice(-3)}` : "PAN pending";
}
function accountContext(draft: Record<string, unknown> | null | undefined) {
  const context = draft?.account_context;
  return context === "posp" || context === "misp" ? context : "partner";
}
function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function PartnerTwoStepNavigation({ applicationId, viewStage, documentsComplete, partnerActive }: { applicationId: string; viewStage: ViewStage; documentsComplete: boolean; partnerActive: boolean }) {
  const current = viewStage === "primary" ? 1 : 2;
  const steps = [
    ["primary", "Primary details", `/intermediaries/applications/${applicationId}/workflow?stage=primary`],
    ["documents", "Partner documents", `/intermediaries/applications/${applicationId}/workflow?stage=documents`],
  ] as const;
  return (
    <nav className="rounded-2xl border border-[#DCE5EF] bg-white/85 px-5 py-5 shadow-sm backdrop-blur">
      <div className="relative mx-auto grid max-w-[760px] grid-cols-2 gap-0 before:absolute before:left-[25%] before:right-[25%] before:top-[18px] before:h-px before:bg-[#CBD5E1] before:content-['']">
        {steps.map((step, index) => {
          const number = index + 1;
          const completed = partnerActive || number < current || (number === 1 && current > 1) || (number === 2 && documentsComplete);
          const active = number === current && !completed;
          return (
            <Link key={step[0]} href={step[2]} className="relative z-[1] min-w-0 text-center">
              <span className={`mx-auto grid h-9 w-9 place-items-center rounded-full border text-[11px] font-bold shadow-[0_0_0_7px_#F8FAFC] transition ${completed ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#071D49] bg-[#071D49] text-white" : "border-[#D7E0EB] bg-[#F1F5F9] text-[#94A3B8]"}`}>{completed ? "✓" : number}</span>
              <span className={`mt-2 block truncate text-[10.5px] font-semibold ${active ? "text-[#071D49]" : completed ? "text-emerald-800" : "text-[#64748B]"}`}>{step[1]}</span>
              <span className="mt-0.5 block text-[8.5px] font-medium text-[#64748B]">{completed ? "Completed" : active ? "Current" : "Upcoming"}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function SixStepNavigation({ applicationId, viewStage, registrationStatus, documentsComplete, agreementSigned }: { applicationId: string; viewStage: ViewStage; registrationStatus: string; documentsComplete: boolean; agreementSigned: boolean }) {
  const current = currentStep(viewStage, registrationStatus);
  const steps = [
    ["primary", "Primary details", `/intermediaries/applications/${applicationId}/workflow?stage=primary`],
    ["documents", "Documents", `/intermediaries/applications/${applicationId}/workflow?stage=documents`],
    ["registration", "Registration", `/intermediaries/applications/${applicationId}/workflow?stage=review#registration-requirement`],
    ["training", "Training & Exam", `/intermediaries/applications/${applicationId}/workflow?stage=review#training-requirement`],
    ["agreement", "Agreement", `/intermediaries/applications/${applicationId}/workflow?stage=review#agreement-requirement`],
    ["iib", "IIB Upload", `/intermediaries/applications/${applicationId}/workflow?stage=review#iib-submission`],
  ] as const;
  return (
    <nav className="overflow-x-auto rounded-2xl border border-[#DCE5EF] bg-white/85 px-5 py-5 shadow-sm backdrop-blur">
      <div className="relative grid min-w-[760px] grid-cols-6 gap-0 before:absolute before:left-[8.4%] before:right-[8.4%] before:top-[18px] before:h-px before:bg-[#CBD5E1] before:content-['']">
        {steps.map((step, index) => {
          const number = index + 1;
          const completed = number < current || (number === 2 && documentsComplete && current > 2) || (number === 5 && agreementSigned && current > 5);
          const active = number === current;
          return (
            <Link key={step[0]} href={step[2]} className="relative z-[1] min-w-0 text-center">
              <span className={`mx-auto grid h-9 w-9 place-items-center rounded-full border text-[11px] font-bold shadow-[0_0_0_7px_#F8FAFC] transition ${completed ? "border-emerald-600 bg-emerald-600 text-white" : active ? "border-[#071D49] bg-[#071D49] text-white" : "border-[#D7E0EB] bg-[#F1F5F9] text-[#94A3B8]"}`}>{completed ? "✓" : number}</span>
              <span className={`mt-2 block truncate text-[10.5px] font-semibold ${active ? "text-[#071D49]" : completed ? "text-emerald-800" : "text-[#64748B]"}`}>{step[1]}</span>
              <span className="mt-0.5 block text-[8.5px] font-medium text-[#64748B]">{completed ? "Completed" : active ? "Current" : "Upcoming"}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function currentStep(viewStage: ViewStage, status: string) {
  if (viewStage === "primary") return 1;
  if (viewStage === "documents") return 2;
  if (status === "iib_registered" || status.includes("iib")) return 6;
  if (status.includes("agreement")) return 5;
  if (status.includes("training") || status.includes("exam")) return 4;
  return 3;
}
