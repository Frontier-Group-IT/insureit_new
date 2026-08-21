import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import type { TrainingProposal } from "@/lib/policy-ocr-training";
import { schedulePolicyOcrTraining } from "@/lib/policy-ocr-training-schedule";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { TrainingReviewQueue, type TrainingQueueRow } from "./training-review-queue";

type TrainingDocumentRow = {
  id: string;
  policy_id: string;
  created_at: string;
  policies: {
    policy_no: string | null;
    policy_code: string | null;
    insurance_companies: { name: string } | null;
  } | null;
  policy_ocr_training_labels: TrainingLabel | TrainingLabel[] | null;
};

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

export const dynamic = "force-dynamic";

export default async function PolicyOcrTrainingPage() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id) redirect("/access-denied");

  const [canReview, canApprove] = await Promise.all([
    hasEffectiveCapability(profile, "review_policy_ocr_training", "edit"),
    hasEffectiveCapability(profile, "approve_policy_ocr_training", "approve"),
  ]);
  if (!canReview && !canApprove) redirect("/access-denied");
  await schedulePolicyOcrTraining();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("policy_documents")
    .select("id,policy_id,created_at,policies(policy_no,policy_code,insurance_companies(name)),policy_ocr_training_labels(*)")
    .eq("document_type", "policy_copy")
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<TrainingDocumentRow[]>();

  const rows = (data ?? []).flatMap<TrainingQueueRow>((document) => {
    const label = Array.isArray(document.policy_ocr_training_labels)
      ? document.policy_ocr_training_labels[0] ?? null
      : document.policy_ocr_training_labels;
    if (!label) return [];
    return [{
      documentId: document.id,
      labelId: label.id,
      fileName: `Policy copy · ${document.id.slice(0, 8).toUpperCase()}`,
      uploadedAt: document.created_at,
      policyReference: document.policies?.policy_no ?? document.policies?.policy_code ?? "-",
      linkedInsurer: document.policies?.insurance_companies?.name ?? "Insurer not linked",
      status: label.status,
      processingStatus: label.processing_status,
      processingAttempts: label.processing_attempts,
      failureCode: label.failure_code,
      proposal: label.proposal,
      parserId: label.parser_id,
      parserVersion: label.parser_version,
      proposedAt: label.proposed_at,
      corrections: {
        insurer_name: label.insurer_name,
        policy_product: label.policy_product,
        policy_number: label.policy_number,
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
        evidence_note: label.evidence_note,
      },
      reviewedBy: label.reviewed_by,
      reviewedAt: label.reviewed_at,
      approvedBy: label.owner_approved_by,
      approvedAt: label.owner_approved_at,
    }];
  });

  return (
    <AppShell title="Premium OCR training">
      <div className="mb-5">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">Premium OCR reviewer queue</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-900">Proposal and correction review</h1>
        <p className="mt-2 max-w-4xl text-sm text-slate-500">
          Google reads private policy copies server-side. Reviewers correct only approved Section 03 fields; a different owner must approve each sanitized training candidate.
        </p>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          The premium OCR reviewer queue is temporarily unavailable.
        </div>
      ) : (
        <TrainingReviewQueue
          rows={rows}
          actorId={profile.id}
          canReview={canReview}
          canApprove={canApprove}
        />
      )}
    </AppShell>
  );
}
