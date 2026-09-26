import "server-only";

import { randomUUID } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  assertFreezeSplitCoverage,
  buildDatasetSnapshot,
  hashDatasetSnapshot,
  type ReviewableTrainingExample,
} from "@/lib/private-voice/dataset-versioning";

const SOURCE_TYPE = "historical_call";
const DATASET_PAGE_SIZE = 500;
const DATASET_INSERT_BATCH_SIZE = 500;

export type TrainingReviewDecision = "approve" | "exclude";

type DatasetBuildRow = {
  id: string;
  version: string;
  status: string;
  training_count: number;
  validation_count: number;
  test_count: number;
};

type DatasetVersionRow = DatasetBuildRow & {
  frozen_at: string;
};

type ApprovedSplitRow = {
  split: "training" | "validation" | "test" | "excluded" | null;
};

function assertPermanentTestBoundary(example: ReviewableTrainingExample) {
  const permanent = example.quality_labels?.permanent_test_candidate === true;
  if (example.split === "test" && !permanent) throw new Error("Test candidate is missing the permanent-test marker.");
  if (example.split !== "test" && permanent) throw new Error("Permanent-test candidate cannot be used outside the test split.");
}

async function loadAllApprovedExamples(): Promise<ReviewableTrainingExample[]> {
  const admin = createSupabaseAdminClient();
  const approved: ReviewableTrainingExample[] = [];

  for (let from = 0; ; from += DATASET_PAGE_SIZE) {
    const to = from + DATASET_PAGE_SIZE - 1;
    const { data, error } = await admin
      .from("private_voice_training_examples")
      .select("id,source_type,source_reference,split,status,context,conversation,target_outcome,quality_labels,reviewed_by,reviewed_at,created_at")
      .eq("source_type", SOURCE_TYPE)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
      .returns<(ReviewableTrainingExample & { created_at?: string })[]>();

    if (error) throw new Error("Could not load approved training examples.");
    const page = data ?? [];
    approved.push(...page);
    if (page.length < DATASET_PAGE_SIZE) break;
  }

  return approved;
}

async function insertDatasetMembers(
  datasetVersionId: string,
  examples: ReviewableTrainingExample[],
) {
  const admin = createSupabaseAdminClient();

  for (let index = 0; index < examples.length; index += DATASET_INSERT_BATCH_SIZE) {
    const batch = examples.slice(index, index + DATASET_INSERT_BATCH_SIZE).map((example) => {
      const snapshot = buildDatasetSnapshot(example);
      return {
        dataset_version_id: datasetVersionId,
        training_example_id: example.id,
        split: example.split,
        example_snapshot: snapshot,
        example_hash: hashDatasetSnapshot(snapshot),
      };
    });

    const { error } = await admin.from("private_voice_dataset_members").insert(batch);
    if (error) throw new Error("Could not freeze dataset membership.");
  }
}

export async function reviewTrainingExample(input: {
  exampleId: string;
  decision: TrainingReviewDecision;
  reviewerId: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: frozenMember, error: frozenError } = await admin
    .from("private_voice_dataset_members")
    .select("id")
    .eq("training_example_id", input.exampleId)
    .limit(1)
    .maybeSingle();
  if (frozenError) throw new Error("Could not verify frozen-dataset membership.");
  if (frozenMember) throw new Error("Frozen dataset examples cannot be reviewed again.");

  const { data: example, error: exampleError } = await admin
    .from("private_voice_training_examples")
    .select("id,source_type,source_reference,split,status,context,conversation,target_outcome,quality_labels,reviewed_by,reviewed_at")
    .eq("id", input.exampleId)
    .eq("source_type", SOURCE_TYPE)
    .single<ReviewableTrainingExample>();
  if (exampleError || !example) throw new Error("Training example not found.");
  if (example.status !== "draft" && example.status !== "reviewed") {
    throw new Error("Only draft or reviewed examples can receive a review decision.");
  }
  assertPermanentTestBoundary(example);

  const reviewedAt = new Date().toISOString();
  const updates = input.decision === "approve"
    ? { status: "approved", reviewed_by: input.reviewerId, reviewed_at: reviewedAt, exclusion_reason: null, updated_at: reviewedAt }
    : { status: "excluded", reviewed_by: input.reviewerId, reviewed_at: reviewedAt, exclusion_reason: "human_review", updated_at: reviewedAt };

  const { error: updateError } = await admin
    .from("private_voice_training_examples")
    .update(updates)
    .eq("id", input.exampleId)
    .eq("source_type", SOURCE_TYPE);
  if (updateError) throw new Error("Could not save the training review decision.");

  return { id: input.exampleId, status: updates.status };
}

function datasetVersionName() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `pv-dataset-${stamp}-${randomUUID().slice(0, 6)}`;
}

export async function freezeApprovedDataset(input: { reviewerId: string; notes?: string | null }) {
  const admin = createSupabaseAdminClient();
  const approved = await loadAllApprovedExamples();
  const counts = assertFreezeSplitCoverage(approved);
  approved.forEach(assertPermanentTestBoundary);

  const version = datasetVersionName();
  const now = new Date().toISOString();
  const manifest = {
    source_type: SOURCE_TYPE,
    split_policy: "deterministic_70_15_15",
    permanent_test_locked: true,
    example_count: approved.length,
    created_at: now,
  };

  const { data: dataset, error: datasetError } = await admin
    .from("private_voice_dataset_versions")
    .insert({
      version,
      status: "building",
      notes: input.notes?.trim() || null,
      manifest,
      training_count: counts.training,
      validation_count: counts.validation,
      test_count: counts.test,
      created_by: input.reviewerId,
      frozen_by: null,
      frozen_at: null,
    })
    .select("id,version,status,training_count,validation_count,test_count")
    .single<DatasetBuildRow>();
  if (datasetError || !dataset) throw new Error("Could not create the dataset version candidate.");

  try {
    await insertDatasetMembers(dataset.id, approved);

    const frozenAt = new Date().toISOString();
    const { data: frozen, error: freezeError } = await admin
      .from("private_voice_dataset_versions")
      .update({ status: "frozen", frozen_by: input.reviewerId, frozen_at: frozenAt, updated_at: frozenAt })
      .eq("id", dataset.id)
      .eq("status", "building")
      .select("id,version,status,training_count,validation_count,test_count,frozen_at")
      .single<DatasetVersionRow>();
    if (freezeError || !frozen) throw new Error("Could not finalize the frozen dataset version.");

    return frozen;
  } catch (error) {
    const failedAt = new Date().toISOString();
    await admin
      .from("private_voice_dataset_versions")
      .update({ status: "failed", updated_at: failedAt })
      .eq("id", dataset.id)
      .eq("status", "building");
    throw error;
  }
}

export async function getTrainingGovernanceOverview() {
  const admin = createSupabaseAdminClient();
  const [{ data: reviewQueue, error: reviewError }, { data: versions, error: versionsError }] = await Promise.all([
    admin
      .from("private_voice_training_examples")
      .select("id,split,status,target_outcome,quality_labels,created_at")
      .eq("source_type", SOURCE_TYPE)
      .in("status", ["draft", "reviewed"])
      .order("created_at", { ascending: true })
      .limit(25),
    admin
      .from("private_voice_dataset_versions")
      .select("id,version,status,training_count,validation_count,test_count,frozen_at")
      .eq("status", "frozen")
      .not("frozen_at", "is", null)
      .order("frozen_at", { ascending: false })
      .limit(8)
      .returns<DatasetVersionRow[]>(),
  ]);
  if (reviewError) throw new Error("Could not load the training review queue.");
  if (versionsError) throw new Error("Could not load frozen dataset versions.");

  const { data: approvedRows, error: approvedError } = await admin
    .from("private_voice_training_examples")
    .select("split")
    .eq("source_type", SOURCE_TYPE)
    .eq("status", "approved")
    .returns<ApprovedSplitRow[]>();
  if (approvedError) throw new Error("Could not count approved training examples.");

  const approved = { training: 0, validation: 0, test: 0 };
  for (const row of approvedRows ?? []) {
    if (row.split === "training" || row.split === "validation" || row.split === "test") approved[row.split] += 1;
  }

  return { reviewQueue: reviewQueue ?? [], approved, versions: versions ?? [] };
}
