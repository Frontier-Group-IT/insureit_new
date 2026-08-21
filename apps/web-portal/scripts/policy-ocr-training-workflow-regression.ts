import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { buildTrainingProposal, compareTrainingProposalToReference, compareTrainingValue, createSanitizedTrainingCandidate, formatReviewerDate, parseReviewerDate, sanitizeEvidenceNote } from "../lib/policy-ocr-training.ts";
// @ts-expect-error -- This regression runner executes TypeScript directly with Node --experimental-strip-types.
import { extractVehicleFields } from "../lib/policy-ocr-parsers.ts";

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

assert.equal(compareTrainingValue("policy_number", "31/28/003126/00001545", "312800312600001545"), "match");
assert.equal(compareTrainingValue("policy_product", "Standalone Own Damage", "SAOD"), "match");
assert.equal(compareTrainingValue("valid_from", "2026-08-21", "21/08/2026"), "match");
assert.equal(compareTrainingValue("od_premium", 6121, "₹6,122"), "match");
assert.equal(compareTrainingValue("tp_premium", 16369, null), "ocr_missing");
assert.equal(compareTrainingValue("vehicle_registration_number", "MH-12-AB-1234", "MH12AB1234"), "match");
assert.equal(compareTrainingValue("vehicle_class", "GCV", "Goods Carrying Vehicle"), "match");
assert.equal(compareTrainingValue("vehicle_capacity", "3500 KG", "3,500"), "match");

const vehicleFields = extractVehicleFields([`Vehicle Registration No: MH 12 AB 1234
Class of Vehicle: Goods Carrying Vehicle
Vehicle Make: TATA MOTORS
Vehicle Model: ACE GOLD
Fuel Type: DIESEL
Year of Manufacture: 2025
GVW: 3500 KG
Chassis No: MAT12345678901234
Engine No: ENG123456789
RTO Name: Pune`]);
const vehicleProposal = Object.fromEntries(vehicleFields.map((field) => [field.key, field.value]));
assert.equal(vehicleProposal.vehicle_registration_number, "MH12AB1234");
assert.equal(vehicleProposal.vehicle_chassis_number, "MAT12345678901234");
assert.equal(vehicleProposal.vehicle_engine_number, "ENG123456789");
assert.equal(vehicleProposal.vehicle_capacity, "3500 KG");

const comparison = compareTrainingProposalToReference(proposal, {
  vehicle_registration_status: null,
  vehicle_registration_number: null,
  vehicle_class: null,
  vehicle_make: null,
  vehicle_model: null,
  vehicle_fuel_type: null,
  vehicle_manufacturing_year: null,
  vehicle_capacity: null,
  vehicle_chassis_number: null,
  vehicle_engine_number: null,
  vehicle_rto_name: null,
  vehicle_rto_state: null,
  insurer_name: null,
  policy_product: null,
  policy_number: null,
  valid_from: null,
  valid_upto: null,
  idv: null,
  od_premium: 6121,
  tp_premium: 16369,
  cpa_opted: null,
  cpa_premium: null,
  printed_net_premium: null,
  printed_gst: null,
  printed_gross_premium: null,
});
assert.equal(comparison.exactMatch, false);
assert.equal(comparison.matchedFields, 1);
assert.equal(comparison.missingOcrFields, 1);
assert.equal(comparison.missingReferenceFields, 23);

const candidate = createSanitizedTrainingCandidate({
  labelId: "abcdef12-3456-7890-abcd-ef1234567890",
  parserId: "test_motor_v1",
  parserVersion: "1",
  values: {
    vehicle_registration_status: "registered",
    vehicle_registration_number: "MH12AB1234",
    vehicle_class: "GCV",
    vehicle_make: "Synthetic Make",
    vehicle_model: "Synthetic Model",
    vehicle_fuel_type: "Diesel",
    vehicle_manufacturing_year: 2025,
    vehicle_capacity: 3500,
    vehicle_chassis_number: "RAWCHASSIS123456",
    vehicle_engine_number: "RAWENGINE123456",
    vehicle_rto_name: "Synthetic RTO",
    vehicle_rto_state: "Synthetic State",
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

assert.equal(candidate.ground_truth.section_03.policy_number, "SYN-ABCDEF123456");
assert.equal(candidate.ground_truth.section_02.vehicle_registration_number, "SYNREGABCDEF123456");
assert.equal(candidate.ground_truth.section_02.vehicle_chassis_number, "SYNCHASSISABCDEF123456");
assert.equal(JSON.stringify(candidate).includes("MH12AB1234"), false);
assert.equal(JSON.stringify(candidate).includes("RAWCHASSIS123456"), false);
assert.equal(JSON.stringify(candidate).includes("evidence_note"), false);
assert.equal(JSON.stringify(candidate).includes("PRIVATE PERSON"), false);

assert.equal(
  sanitizeEvidenceNote("PAN ABCDE1234F phone 9876543210 email test@example.com"),
  "PAN [redacted] phone [redacted] email [redacted]",
);

const migration = readFileSync("../../supabase/migrations/20260821153000_premium_ocr_training_workflow.sql", "utf8");
assert.match(migration, /processing_attempts < 3/);
assert.match(migration, /for update skip locked/i);
assert.match(migration, /status = 'approved'[\s\S]+owner_approved_by is null/);
assert.match(migration, /insert into public\.policy_ocr_training_labels[\s\S]+policy_documents/);
assert.match(migration, /after insert or update of storage_bucket, storage_path, mime_type, file_size/);
assert.doesNotMatch(migration, /add constraint policy_ocr_training_labels_separate_approval_check/);

const actions = readFileSync("app/policies/ocr-training-actions.ts", "utf8");
const trainingAccess = readFileSync("lib/policy-ocr-training-access.ts", "utf8");
const workerActions = readFileSync("app/policies/policy-ocr-actions.ts", "utf8");
assert.match(trainingAccess, /review_policy_ocr_training/);
assert.match(trainingAccess, /approve_policy_ocr_training/);
assert.match(trainingAccess, /profile\.role !== "it_super_user"/);
assert.match(workerActions, /google_ocr_configuration_missing/);
assert.match(workerActions, /google_oidc_subject_token_missing/);
assert.match(workerActions, /Automated comparison reference from saved Section 02 and Section 03 data/);
assert.match(workerActions, /compareTrainingProposalToReference/);
assert.match(workerActions, /processPolicyOcrTrainingDocument/);
assert.match(workerActions, /requirePolicyOcrTrainingOperator/);
assert.doesNotMatch(actions, /POLICY_OCR_WORKER_SECRET|CRON_SECRET/);
assert.match(actions, /RunPolicyOcrTrainingState/);
assert.match(actions, /Google OCR completed/);
assert.match(workerActions, /\.eq\("id", label\.id\)/);
assert.match(workerActions, /\.eq\("processing_status", label\.processing_status\)/);
assert.match(actions, /runPolicyOcrTrainingLabel/);
assert.doesNotMatch(actions, /writeFile|appendFile|apply_patch/);

assert.equal(existsSync("app/api/internal/policy-ocr-training/process/route.ts"), false);
assert.equal(existsSync("lib/policy-ocr-training-schedule.ts"), false);
const vercelConfig = readFileSync("vercel.json", "utf8");
assert.doesNotMatch(vercelConfig, /"crons"/);

const uploadActions = [
  readFileSync("app/policies/policy-document-actions.ts", "utf8"),
  readFileSync("app/policies/policy-edit-document-actions.ts", "utf8"),
];
for (const source of uploadActions) assert.doesNotMatch(source, /schedulePolicyOcrTraining|processPolicyOcrTraining/);

const queuePage = readFileSync("app/policies/ocr-training/page.tsx", "utf8");
assert.match(queuePage, /requirePolicyOcrTrainingOperator/);
assert.match(queuePage, /document\.file_name/);
assert.match(queuePage, /\.range\(0, 999\)/);
assert.doesNotMatch(queuePage, /schedulePolicyOcrTraining/);
const queueComponent = readFileSync("app/policies/ocr-training/training-review-queue.tsx", "utf8");
assert.match(queueComponent, /Run with Google Cloud/);
assert.match(queueComponent, /Re-run with Google Cloud/);
assert.match(queueComponent, /useActionState/);
assert.match(queueComponent, /Confirm comparison & approve training/);
assert.doesNotMatch(queueComponent, /different training owner|No self-approval|Awaiting owner/);

const appNavigation = readFileSync("components/claim-manager/app-navigation.tsx", "utf8");
assert.match(appNavigation, /href:"\/policies\/ocr-training",label:"OCR Training"/);
assert.match(appNavigation, /role==="it_super_user"[\s\S]+developmentSection/);
assert.match(appNavigation, /pathname==="\/policies\/ocr-training"[\s\S]+return"development"/);

const singleOperatorMigration = readFileSync("../../supabase/migrations/20260822000100_single_operator_policy_ocr_training.sql", "utf8");
assert.match(singleOperatorMigration, /drop constraint if exists policy_ocr_training_labels_separate_approval_check/);
assert.match(singleOperatorMigration, /approve_policy_ocr_database_comparison/);
assert.doesNotMatch(singleOperatorMigration, /self_approval_forbidden|owner_approved_by <> reviewed_by/);
assert.match(actions, /approve_policy_ocr_database_comparison/);
assert.doesNotMatch(actions, /requireTrainingOwner|requireTrainingReviewer|reviewed_by === owner\.id/);

const section02TrainingMigration = readFileSync("../../supabase/migrations/20260822093000_policy_ocr_section_02_training.sql", "utf8");
assert.match(section02TrainingMigration, /section_02_reference/);
assert.match(section02TrainingMigration, /policy_ocr_training_candidate_v2/);
assert.match(section02TrainingMigration, /SYNCHASSIS/);
assert.match(section02TrainingMigration, /set search_path = ''/);
assert.match(section02TrainingMigration, /revoke all on function public\.approve_policy_ocr_database_comparison/);

const migrationWorkflow = readFileSync("../../.github/workflows/apply-supabase-migrations.yml", "utf8");
assert.match(migrationWorkflow, /20260822093000_policy_ocr_section_02_training\.sql/);
assert.match(migrationWorkflow, /section_02_reference_ready/);

const importPanel = readFileSync("components/policy-ocr-import-panel.tsx", "utf8");
for (const field of ["vehicle_registration_status", "vehicle_registration_number", "vehicle_class", "vehicle_chassis_number", "vehicle_engine_number"]) {
  assert.match(importPanel, new RegExp(field));
}
assert.doesNotMatch(importPanel, /"insured_name"|"phone_number"/);

const section02Map = readFileSync("../../docs/POLICY_OCR_SECTION_02_FIELD_MAP.md", "utf8");
for (const field of ["registrationNumber", "classCode", "engine_capacity_cc", "seating_capacity", "gvw_kg", "chassis_no", "engine_no"]) {
  assert.match(section02Map, new RegExp(field));
}

const legacyLinkMigration = readFileSync("../../supabase/migrations/20260821220000_link_legacy_policy_copies_to_ocr.sql", "utf8");
assert.match(legacyLinkMigration, /customer_documents/);
assert.match(legacyLinkMigration, /candidate_count = 1/);
assert.match(legacyLinkMigration, /filename_match_count = 1/);

console.log("Policy OCR training workflow regression: passed.");
