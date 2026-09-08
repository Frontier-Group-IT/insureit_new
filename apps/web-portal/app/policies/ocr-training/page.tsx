import { AppShell } from "@/components/shell";
import { requirePolicyOcrTrainingViewer } from "@/lib/policy-ocr-training-access";
import type { TrainingProposal } from "@/lib/policy-ocr-training";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { TrainingReviewQueue, type TrainingQueueRow } from "./training-review-queue";
import { recordPolicyOcrSatisfaction, createPolicyOcrTrainingRun, startPolicyOcrTrainingRun, stopPolicyOcrTrainingRun } from "../ocr-training-orchestrator-actions";

type TrainingDocumentRow = {
  id: string;
  policy_id: string;
  file_name: string;
  created_at: string;
  policies: {
    policy_no: string | null;
    policy_type: string | null;
    start_date: string | null;
    end_date: string | null;
    insured_declared_value: number | null;
    policy_code: string | null;
    vehicles: VehicleReference | null;
    policy_party_snapshots: PolicySnapshotReference | PolicySnapshotReference[] | null;
    insurance_companies: { name: string } | null;
    policy_premium_details: PolicyPremiumReference | PolicyPremiumReference[] | null;
  } | null;
  policy_ocr_training_labels: TrainingLabel | TrainingLabel[] | null;
};

type PolicyPremiumReference = {
  od_premium: number | null;
  tp_premium: number | null;
  cpa_opted: boolean | null;
  cpa_amount: number | null;
  net_premium: number | null;
  gst_amount: number | null;
  gross_premium: number | null;
};

type PolicySnapshotReference = { registration_number: string | null; vehicle_class: string | null; make: string | null; model: string | null; fuel_type: string | null; manufacturing_year: number | null; capacity_value: string | null; chassis_no: string | null; engine_no: string | null; rto_name: string | null; rto_state: string | null; created_at: string };
type VehicleReference = { vehicle_no: string | null; registration_status: string | null; vehicle_type: string | null; vehicle_class_code: string | null; vehicle_class_description: string | null; make: string | null; model: string | null; fuel_type: string | null; year: number | null; engine_capacity_cc: number | null; seating_capacity: number | null; gvw_kg: number | null; chassis_no: string | null; engine_no: string | null; rto_name: string | null; rto_state: string | null };

type TrainingLabel = {
  id: string;
  status: TrainingQueueRow["status"];
  processing_status: TrainingQueueRow["processingStatus"];
  processing_attempts: number;
  failure_code: string | null;
  proposal: TrainingProposal | null;
  parser_id: string | null;
  parser_version: string | null;
  proposed_at: string | null;
  insurer_name: string | null;
  policy_product: string | null;
  policy_number: string | null;
  valid_from: string | null;
  valid_upto: string | null;
  idv: number | null;
  od_premium: number | null;
  tp_premium: number | null;
  cpa_opted: boolean | null;
  cpa_premium: number | null;
  printed_net_premium: number | null;
  printed_gst: number | null;
  printed_gross_premium: number | null;
  evidence_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  owner_approved_by: string | null;
  owner_approved_at: string | null;
};

type ReviewTaskRow = {
  id: string;
  training_label_id: string;
  assigned_reviewer_profile_id: string;
  assignment_version: number;
  status: "assigned" | "in_review" | "completed" | "rejected" | "cancelled";
  checklist: Record<string, boolean>;
  reviewer_note: string | null;
  assigned_at: string;
  completed_at: string | null;
  field_questions: Array<{ key: string; issue: string; prompt: string; allowedAnswers: string[] }>;
  policy_ocr_training_review_notifications: Array<{
    status: "pending" | "sent" | "failed";
    attempts: number;
    sent_at: string | null;
  }> | null;
};

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function PolicyOcrTrainingPage({ searchParams }: { searchParams?: Promise<{ document?: string }> }) {
  const viewer = await requirePolicyOcrTrainingViewer();
  const selectedDocumentId = (await searchParams)?.document;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("policy_documents")
    .select("id,policy_id,file_name,created_at,policies(policy_no,policy_type,start_date,end_date,insured_declared_value,policy_code,insurance_companies(name),vehicles(vehicle_no,registration_status,vehicle_type,vehicle_class_code,vehicle_class_description,make,model,fuel_type,year,engine_capacity_cc,seating_capacity,gvw_kg,chassis_no,engine_no,rto_name,rto_state),policy_party_snapshots(registration_number,vehicle_class,make,model,fuel_type,manufacturing_year,capacity_value,chassis_no,engine_no,rto_name,rto_state,created_at),policy_premium_details(od_premium,tp_premium,cpa_opted,cpa_amount,net_premium,gst_amount,gross_premium)),policy_ocr_training_labels(*)", { count: "exact" })
    .eq("document_type", "policy_copy")
    .order("created_at", { ascending: false })
    .range(0, 999)
    .returns<TrainingDocumentRow[]>();

  const labelIds = (data ?? []).flatMap((document) => {
    const label = Array.isArray(document.policy_ocr_training_labels)
      ? document.policy_ocr_training_labels[0] ?? null
      : document.policy_ocr_training_labels;
    return label?.id ? [label.id] : [];
  });
  let reviewTasks: ReviewTaskRow[] = [];
  if (labelIds.length) {
    let taskQuery = admin
      .from("policy_ocr_training_review_tasks")
      .select("id,training_label_id,assigned_reviewer_profile_id,assignment_version,status,checklist,reviewer_note,assigned_at,completed_at,field_questions,policy_ocr_training_review_notifications(status,attempts,sent_at)")
      .in("training_label_id", labelIds);
    taskQuery = taskQuery.neq("status", "cancelled");
    if (!viewer.isOperator) taskQuery = taskQuery.eq("assigned_reviewer_profile_id", viewer.profile.id);
    const { data: tasks } = await taskQuery.returns<ReviewTaskRow[]>();
    reviewTasks = tasks ?? [];
  }
  const taskByLabelId = new Map(reviewTasks.map((task) => [task.training_label_id, task]));
  const { data: satisfactionTasks } = !viewer.isOperator
    ? await admin.from("policy_ocr_training_review_tasks")
      .select("id,status")
      .eq("assigned_reviewer_profile_id", viewer.profile.id)
      .eq("task_type", "satisfaction")
      .in("status", ["assigned", "in_review"])
      .returns<Array<{ id: string; status: string }>>()
    : { data: [] as Array<{ id: string; status: string }> };
  const { data: orchestratorRuns } = viewer.isOperator
    ? await admin.from("policy_ocr_training_orchestrators").select("id,status,processed_count,sample_budget,field_accuracy").order("created_at", { ascending: false }).limit(3)
    : { data: [] as Array<{ id: string; status: string; processed_count: number; sample_budget: number; field_accuracy: number | null }> };
  const rows = (data ?? []).flatMap<TrainingQueueRow>((document) => {
    const label = Array.isArray(document.policy_ocr_training_labels)
      ? document.policy_ocr_training_labels[0] ?? null
      : document.policy_ocr_training_labels;
    if (!label) return [];
    const premium = document.policies?.policy_premium_details;
    const databasePremium = Array.isArray(premium) ? premium[0] ?? null : premium;
    const snapshots = document.policies?.policy_party_snapshots;
    const snapshot = (Array.isArray(snapshots) ? snapshots : snapshots ? [snapshots] : []).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    const vehicle = document.policies?.vehicles ?? null;
    const pendingRegistration = isRegistrationPending(snapshot?.registration_number, vehicle?.registration_status, vehicle?.vehicle_no);
    const vehicleClass = vehicle?.vehicle_class_code || snapshot?.vehicle_class || vehicle?.vehicle_class_description || vehicle?.vehicle_type || null;
    const reviewTask = taskByLabelId.get(label.id) ?? null;
    if (!viewer.isOperator && !reviewTask) return [];
    return [{
      documentId: document.id,
      labelId: label.id,
      fileName: document.file_name || `Policy copy · ${document.id.slice(0, 8).toUpperCase()}`,
      uploadedAt: document.created_at,
      policyReference: document.policies?.policy_no ?? document.policies?.policy_code ?? "-",
      linkedInsurer: document.policies?.insurance_companies?.name ?? "Insurer not linked",
      databaseReference: {
        vehicle_registration_status: pendingRegistration ? "registration_pending" : "registered",
        vehicle_registration_number: pendingRegistration ? null : usableRegistration(snapshot?.registration_number) || usableRegistration(vehicle?.vehicle_no),
        vehicle_class: vehicleClass,
        vehicle_make: snapshot?.make || vehicle?.make || null,
        vehicle_model: snapshot?.model || vehicle?.model || null,
        vehicle_fuel_type: snapshot?.fuel_type || vehicle?.fuel_type || null,
        vehicle_manufacturing_year: snapshot?.manufacturing_year ?? vehicle?.year ?? null,
        vehicle_capacity: snapshot?.capacity_value || capacityForClass(vehicle, vehicleClass),
        vehicle_chassis_number: snapshot?.chassis_no || vehicle?.chassis_no || null,
        vehicle_engine_number: snapshot?.engine_no || vehicle?.engine_no || null,
        vehicle_rto_name: snapshot?.rto_name || vehicle?.rto_name || null,
        vehicle_rto_state: snapshot?.rto_state || vehicle?.rto_state || null,
        insurer_name: document.policies?.insurance_companies?.name ?? null,
        policy_product: document.policies?.policy_type ?? null,
        policy_number: document.policies?.policy_no ?? null,
        valid_from: document.policies?.start_date ?? null,
        valid_upto: document.policies?.end_date ?? null,
        idv: document.policies?.insured_declared_value ?? null,
        od_premium: databasePremium?.od_premium ?? null,
        tp_premium: databasePremium?.tp_premium ?? null,
        cpa_opted: databasePremium?.cpa_opted ?? null,
        cpa_premium: databasePremium?.cpa_amount ?? null,
        printed_net_premium: databasePremium?.net_premium ?? null,
        printed_gst: databasePremium?.gst_amount ?? null,
        printed_gross_premium: databasePremium?.gross_premium ?? null,
      },
      status: label.status,
      processingStatus: label.processing_status,
      processingAttempts: label.processing_attempts,
      failureCode: label.failure_code,
      proposal: label.proposal,
      parserId: label.parser_id,
      parserVersion: label.parser_version,
      proposedAt: label.proposed_at,
      reviewedBy: label.reviewed_by,
      reviewedAt: label.reviewed_at,
      approvedBy: label.owner_approved_by,
      approvedAt: label.owner_approved_at,
      reviewTask,
    }];
  });

  return (
    <AppShell title="Policy OCR training">
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-black tracking-tight text-navy-900">Policy OCR training</h1>
          <span className="text-[11px] font-semibold text-slate-500">{rows.length} policy copies · queue status</span>
        </div>
      </div>
      {viewer.isOperator ? <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-bold text-navy-900">Controlled training iterations</p><p className="text-xs text-slate-500">Create a planned run, then explicitly start or stop it. Reviewer answers start parser training automatically.</p></div>
          <form action={createPolicyOcrTrainingRun}><button className="rounded-lg bg-navy-900 px-3 py-2 text-xs font-bold text-white">Create planned run</button></form>
        </div>
        <div className="mt-3 space-y-2">{(orchestratorRuns ?? []).map((run) => <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-xs">
          <span><strong>{run.status}</strong> · {run.processed_count}/{run.sample_budget} samples · {run.field_accuracy == null ? "accuracy pending" : `${Math.round(run.field_accuracy * 100)}%`} · <code>{run.id.slice(0, 8)}</code></span>
          <div className="flex gap-2">{run.status === "planned" ? <form action={startPolicyOcrTrainingRun}><input type="hidden" name="orchestrator_id" value={run.id} /><button className="rounded border border-emerald-200 px-2 py-1 font-bold text-emerald-700">Start</button></form> : null}{["planned", "running", "paused"].includes(run.status) ? <form action={stopPolicyOcrTrainingRun}><input type="hidden" name="orchestrator_id" value={run.id} /><button className="rounded border border-red-200 px-2 py-1 font-bold text-red-700">Stop</button></form> : null}</div>
        </div>)}</div>
      </section> : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          The premium OCR reviewer queue is temporarily unavailable.
        </div>
      ) : (
        <>
          {satisfactionTasks?.length ? <form action={recordPolicyOcrSatisfaction} className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <input type="hidden" name="review_task_id" value={satisfactionTasks[0].id} />
            <p className="text-sm font-bold text-emerald-900">Fresh-policy satisfaction check</p>
            <p className="mt-1 text-xs text-emerald-800">Upload/check a fresh policy copy in the protected workflow, then record whether the result meets your expectations.</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-xs font-semibold text-emerald-950">Result
                <select name="satisfied" defaultValue="" required className="mt-1 block h-9 rounded-lg border border-emerald-300 bg-white px-2 text-xs"><option value="" disabled>Select</option><option value="yes">Satisfied</option><option value="no">Not satisfied</option></select>
              </label>
              <input name="note" maxLength={500} placeholder="Safe note; no identifiers" className="h-9 min-w-64 rounded-lg border border-emerald-300 bg-white px-2 text-xs" />
              <button className="h-9 rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white">Record satisfaction</button>
            </div>
          </form> : null}
          <TrainingReviewQueue rows={rows} canTrain={viewer.isOperator} canAssign={viewer.isOperator} selectedDocumentId={selectedDocumentId} />
        </>
      )}
    </AppShell>
  );
}

function isRegistrationPending(snapshotRegistration?: string | null, status?: string | null, vehicleNo?: string | null) {
  return /pending|unregistered/i.test(snapshotRegistration ?? "") || /pending|unregistered/i.test(status ?? "") || /^(?:NEW|PENDING)-/i.test(vehicleNo ?? "");
}

function usableRegistration(value?: string | null) {
  const clean = value?.trim() ?? "";
  return clean && !/pending|unregistered/i.test(clean) && !/^(?:NEW|PENDING)-/i.test(clean) ? clean : null;
}

function capacityForClass(vehicle: VehicleReference | null, vehicleClass: string | null) {
  if (!vehicle) return null;
  const normalizedClass = (vehicleClass ?? "").toUpperCase();
  if (["PCP", "TWP"].includes(normalizedClass)) return vehicle.engine_capacity_cc;
  if (normalizedClass === "PCV") return vehicle.seating_capacity;
  if (["GCV", "CPM"].includes(normalizedClass)) return vehicle.gvw_kg;
  return vehicle.engine_capacity_cc ?? vehicle.gvw_kg ?? vehicle.seating_capacity;
}
