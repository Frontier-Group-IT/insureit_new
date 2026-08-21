import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { buildTrainingProposal, createSanitizedTrainingCandidate, formatReviewerDate, parseReviewerDate, sanitizeEvidenceNote } from "../lib/policy-ocr-training.ts";

assert.equal(parseReviewerDate("21/08/2026"), "2026-08-21");
assert.equal(parseReviewerDate("31/02/2026"), null);
assert.equal(parseReviewerDate("2026-08-21"), null);
assert.equal(formatReviewerDate("2026-08-21"), "21/08/2026");

const proposal = buildTrainingProposal({
  ok: true,
  fields: [
    {
      key: "od_premium",
      label: "OD premium",
      value: "6121",
      confidence: 1.5,
      page: 2,
      evidence: "CUSTOMER NAME 9999999999 Total OD Premium 6121",
    },
    {
      key: "insured_name",
      label: "Insured name",
      value: "PRIVATE PERSON",
      confidence: 0.99,
      page: 1,
      evidence: "PRIVATE PERSON",
    },
  ],
  warnings: ["Contact test@example.com or 9876543210 for raw OCR details"],
});

assert.deepEqual(Object.keys(proposal.fields), ["od_premium"]);
assert.equal(proposal.fields.od_premium?.confidence, 1);
assert.equal(proposal.fields.od_premium?.evidence, "Total OD Premium · Page 2");
assert.equal(JSON.stringify(proposal).includes("CUSTOMER NAME"), false);
assert.equal(JSON.stringify(proposal).includes("PRIVATE PERSON"), false);
assert.equal(proposal.warnings[0].includes("test@example.com"), false);
assert.equal(proposal.warnings[0].includes("9876543210"), false);

const candidate = createSanitizedTrainingCandidate({
  labelId: "abcdef12-3456-7890-abcd-ef1234567890",
  parserId: "test_motor_v1",
  parserVersion: "1",
  values: {
    insurer_name: "Synthetic Insurance",
    policy_product: "Package",
    valid_from: "2026-08-21",
    valid_upto: "2027-08-20",
    idv: 500000,
    od_premium: 6121,
    tp_premium: 16369,
    cpa_opted: true,
    cpa_premium: 275,
    printed_net_premium: 22765,
    printed_gst: 4097.7,
    printed_gross_premium: 26862.7,
  },
  proposal,
});

assert.equal(candidate.ground_truth.policy_number, "SYN-ABCDEF123456");
assert.equal(JSON.stringify(candidate).includes("evidence_note"), false);
assert.equal(JSON.stringify(candidate).includes("PRIVATE PERSON"), false);

assert.equal(
  sanitizeEvidenceNote("PAN ABCDE1234F phone 9876543210 email test@example.com"),
  "PAN [redacted] phone [redacted] email [redacted]",
);

const migration = readFileSync("../../supabase/migrations/20260821153000_premium_ocr_training_workflow.sql", "utf8");
assert.match(migration, /processing_attempts < 3/);
assert.match(migration, /for update skip locked/i);
assert.match(migration, /owner_approved_by <> reviewed_by/);
assert.match(migration, /training_label_self_approval_forbidden/);
assert.match(migration, /insert into public\.policy_ocr_training_labels[\s\S]+policy_documents/);
assert.match(migration, /after insert or update of storage_bucket, storage_path, mime_type, file_size/);

const actions = readFileSync("app/policies/ocr-training-actions.ts", "utf8");
assert.match(actions, /review_policy_ocr_training/);
assert.match(actions, /approve_policy_ocr_training/);
assert.match(actions, /reviewed_by === owner\.id/);
assert.doesNotMatch(actions, /writeFile|appendFile|apply_patch/);

const uploadActions = [
  readFileSync("app/policies/policy-document-actions.ts", "utf8"),
  readFileSync("app/policies/policy-edit-document-actions.ts", "utf8"),
];
for (const source of uploadActions) assert.match(source, /schedulePolicyOcrTraining/);

const queuePage = readFileSync("app/policies/ocr-training/page.tsx", "utf8");
assert.doesNotMatch(queuePage, /document\.file_name/);

console.log("Policy OCR training workflow regression: passed.");
