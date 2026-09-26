import assert from "node:assert/strict";

import {
  assertFreezeSplitCoverage,
  buildDatasetSnapshot,
  hashDatasetSnapshot,
  type ReviewableTrainingExample,
} from "../lib/private-voice/dataset-versioning.ts";

function example(id: string, split: "training" | "validation" | "test", permanentTestCandidate = split === "test"): ReviewableTrainingExample {
  return {
    id,
    source_type: "historical_call",
    source_reference: `source-${id}`,
    split,
    status: "approved",
    context: { vehicle_model: "Test", nested: { b: 2, a: 1 } },
    conversation: [],
    target_outcome: { disposition: "follow_up" },
    quality_labels: { permanent_test_candidate: permanentTestCandidate },
    reviewed_by: "reviewer",
    reviewed_at: "2026-09-26T00:00:00.000Z",
  };
}

const train = example("1", "training");
const validation = example("2", "validation");
const test = example("3", "test");

assert.deepEqual(assertFreezeSplitCoverage([train, validation, test]), { training: 1, validation: 1, test: 1 });
assert.throws(() => assertFreezeSplitCoverage([train, validation]), /permanent-test/);
assert.throws(() => buildDatasetSnapshot(example("4", "test", false)), /permanent-test/);
assert.throws(() => buildDatasetSnapshot(example("5", "training", true)), /Permanent-test/);

const snapshotA = buildDatasetSnapshot(train);
const snapshotB = { ...snapshotA, context: { nested: { a: 1, b: 2 }, vehicle_model: "Test" } };
assert.equal(hashDatasetSnapshot(snapshotA), hashDatasetSnapshot(snapshotB));

const changed = { ...snapshotA, target_outcome: { disposition: "quote_requested" } };
assert.notEqual(hashDatasetSnapshot(snapshotA), hashDatasetSnapshot(changed));

console.log("Private voice dataset versioning regression passed.");
