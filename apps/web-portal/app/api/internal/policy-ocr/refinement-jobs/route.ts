import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSanitizedTrainingCandidate, hasStaleTrainingEvidenceLabels, type TrainingDatabaseReference, type TrainingProposal } from "@/lib/policy-ocr-training";

function authorized(request: Request) {
  const secret = process.env.POLICY_OCR_WORKER_SECRET;
  return Boolean(secret && request.headers.get("x-insureit-policy-ocr-worker-secret") === secret);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createSupabaseAdminClient();
  const { data: job, error } = await admin
    .from("policy_ocr_refinement_jobs")
    .select("id,training_candidate_id,attempts")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "job_lookup_failed" }, { status: 500 });
  if (!job) return NextResponse.json({ job: null });

  const { data: claimed, error: claimError } = await admin
    .from("policy_ocr_refinement_jobs")
    .update({
      status: "claimed",
      attempts: job.attempts + 1,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id,training_candidate_id")
    .maybeSingle();
  if (claimError || !claimed) return NextResponse.json({ job: null });

  const { data: candidate, error: candidateError } = await admin
    .from("policy_ocr_training_candidates")
    .select("id,training_label_id,approved_by,candidate_payload")
    .eq("id", claimed.training_candidate_id)
    .maybeSingle();
  if (candidateError || !candidate) return NextResponse.json({ error: "candidate_lookup_failed" }, { status: 500 });

  let candidatePayload = candidate.candidate_payload;
  if (hasStaleTrainingEvidenceLabels(candidatePayload)) {
    const { data: label, error: labelError } = await admin
      .from("policy_ocr_training_labels")
      .select("id,parser_id,parser_version,proposal,section_02_reference,insurer_name,policy_product,valid_from,valid_upto,idv,od_premium,tp_premium,cpa_opted,cpa_premium,printed_net_premium,printed_gst,printed_gross_premium")
      .eq("id", candidate.training_label_id)
      .maybeSingle();
    if (labelError || !label || !candidate.approved_by) {
      return NextResponse.json({ error: "candidate_refresh_failed" }, { status: 500 });
    }
    const payload = candidatePayload as {
      ground_truth?: {
        section_02?: Record<string, unknown>;
      };
    };
    const section02 = payload.ground_truth?.section_02 ?? {};
    const reference = (label.section_02_reference ?? {}) as Partial<TrainingDatabaseReference>;
    const refreshed = createSanitizedTrainingCandidate({
      labelId: label.id,
      parserId: label.parser_id,
      parserVersion: label.parser_version,
      values: {
        vehicle_registration_status: reference.vehicle_registration_status ?? null,
        vehicle_registration_number: section02.vehicle_registration_number ? String(section02.vehicle_registration_number) : null,
        vehicle_class: reference.vehicle_class ?? stringValue(section02.vehicle_class),
        vehicle_make: reference.vehicle_make ?? stringValue(section02.vehicle_make),
        vehicle_model: reference.vehicle_model ?? stringValue(section02.vehicle_model),
        vehicle_fuel_type: reference.vehicle_fuel_type ?? stringValue(section02.vehicle_fuel_type),
        vehicle_manufacturing_year: reference.vehicle_manufacturing_year ?? numberValue(section02.vehicle_manufacturing_year),
        vehicle_capacity: reference.vehicle_capacity ?? (typeof section02.vehicle_capacity === "string" || typeof section02.vehicle_capacity === "number" ? section02.vehicle_capacity : null),
        vehicle_chassis_number: section02.vehicle_chassis_number ? String(section02.vehicle_chassis_number) : null,
        vehicle_engine_number: section02.vehicle_engine_number ? String(section02.vehicle_engine_number) : null,
        vehicle_rto_name: reference.vehicle_rto_name ?? stringValue(section02.vehicle_rto_name),
        vehicle_rto_state: reference.vehicle_rto_state ?? stringValue(section02.vehicle_rto_state),
        insurer_name: label.insurer_name,
        policy_product: label.policy_product,
        valid_from: label.valid_from,
        valid_upto: label.valid_upto,
        idv: label.idv,
        od_premium: label.od_premium,
        tp_premium: label.tp_premium,
        cpa_opted: label.cpa_opted,
        cpa_premium: label.cpa_premium,
        printed_net_premium: label.printed_net_premium,
        printed_gst: label.printed_gst,
        printed_gross_premium: label.printed_gross_premium,
      },
      proposal: label.proposal as TrainingProposal | null,
    });
    const { error: refreshError } = await admin.rpc("approve_policy_ocr_training_candidate", {
      p_label_id: label.id,
      p_actor_id: candidate.approved_by,
      p_candidate_payload: refreshed,
    });
    if (refreshError) return NextResponse.json({ error: "candidate_refresh_failed" }, { status: 500 });
    candidatePayload = refreshed;
  }
  return NextResponse.json({ job: { id: claimed.id, candidate: { id: candidate.id, candidate_payload: candidatePayload } } });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await request.json() as { id?: string; status?: "pr_open" | "failed"; branchName?: string; pullRequestNumber?: number; errorMessage?: string };
  if (!body.id || !body.status) return NextResponse.json({ error: "invalid_job_update" }, { status: 400 });
  const { error } = await createSupabaseAdminClient()
    .from("policy_ocr_refinement_jobs")
    .update({
      status: body.status,
      branch_name: body.branchName ?? null,
      pull_request_number: body.pullRequestNumber ?? null,
      error_message: body.errorMessage ?? null,
      completed_at: body.status === "pr_open" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id)
    .eq("status", "claimed");
  if (error) return NextResponse.json({ error: "job_update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
