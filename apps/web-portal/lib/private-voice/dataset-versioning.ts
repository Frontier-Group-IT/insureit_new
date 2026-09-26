import { createHash } from "node:crypto";

export type DatasetSplit = "training" | "validation" | "test";

export type ReviewableTrainingExample = {
  id: string;
  source_type: string;
  source_reference: string | null;
  split: DatasetSplit | "excluded" | null;
  status: "draft" | "reviewed" | "approved" | "excluded";
  context: Record<string, unknown>;
  conversation: unknown[];
  target_outcome: Record<string, unknown> | null;
  quality_labels: Record<string, unknown>;
  reviewed_by: string | null;
  reviewed_at: string | null;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function buildDatasetSnapshot(example: ReviewableTrainingExample) {
  if (!example.split || !["training", "validation", "test"].includes(example.split)) {
    throw new Error("Only training, validation and test examples can be frozen.");
  }
  if (example.status !== "approved") throw new Error("Only approved examples can be frozen.");

  const permanentTestCandidate = example.quality_labels?.permanent_test_candidate === true;
  if (example.split === "test" && !permanentTestCandidate) {
    throw new Error("Test examples must be marked as permanent-test candidates.");
  }
  if (example.split !== "test" && permanentTestCandidate) {
    throw new Error("Permanent-test candidates cannot be frozen into training or validation.");
  }

  return stableValue({
    source_type: example.source_type,
    source_reference: example.source_reference,
    split: example.split,
    context: example.context,
    conversation: example.conversation,
    target_outcome: example.target_outcome,
    quality_labels: example.quality_labels,
    reviewed_by: example.reviewed_by,
    reviewed_at: example.reviewed_at,
  }) as Record<string, unknown>;
}

export function hashDatasetSnapshot(snapshot: Record<string, unknown>) {
  return createHash("sha256").update(JSON.stringify(stableValue(snapshot))).digest("hex");
}

export function assertFreezeSplitCoverage(examples: ReviewableTrainingExample[]) {
  const counts = { training: 0, validation: 0, test: 0 };
  for (const example of examples) {
    if (example.status !== "approved") continue;
    if (example.split === "training" || example.split === "validation" || example.split === "test") {
      counts[example.split] += 1;
    }
  }
  if (!counts.training || !counts.validation || !counts.test) {
    throw new Error("A frozen dataset requires at least one approved training, validation and permanent-test example.");
  }
  return counts;
}
