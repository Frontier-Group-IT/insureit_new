import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

function authorized(request: Request) {
  const secret = process.env.POLICY_OCR_WORKER_SECRET;
  return Boolean(secret && request.headers.get("x-insureit-policy-ocr-worker-secret") === secret);
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
    .select("id,candidate_payload")
    .eq("id", claimed.training_candidate_id)
    .maybeSingle();
  if (candidateError || !candidate) return NextResponse.json({ error: "candidate_lookup_failed" }, { status: 500 });
  return NextResponse.json({ job: { id: claimed.id, candidate } });
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
