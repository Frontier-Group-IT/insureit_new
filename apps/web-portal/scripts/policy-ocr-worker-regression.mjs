import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const route = fs.readFileSync(path.join(root, "app/api/internal/policy-ocr/worker/route.ts"), "utf8");
const automation = fs.readFileSync(path.join(root, "lib/policy-ocr-review-automation.ts"), "utf8");
const actions = fs.readFileSync(path.join(root, "app/policies/policy-ocr-actions.ts"), "utf8");
const workflow = fs.readFileSync(path.join(root, "../../.github/workflows/policy-ocr-worker.yml"), "utf8");

assert.match(route, /POLICY_OCR_WORKER_SECRET/);
assert.match(route, /timingSafeEqual/);
assert.match(route, /x-vercel-oidc-token/);
assert.match(route, /processPolicyOcrTrainingWorkerBatch/);
assert.match(workflow, /schedule:/);
assert.match(workflow, /POLICY_OCR_WORKER_SECRET/);
assert.match(actions, /claim_policy_ocr_training_jobs/);
assert.match(actions, /ensureAutomaticPolicyOcrReview/);
assert.match(automation, /comparison\.exactMatch && !hasAmbiguity/);
assert.match(automation, /anju@insureit\.in/);
assert.match(automation, /it@insureit\.in/);
assert.match(automation, /onConflict: "review_task_id,assignment_version"/);
assert.doesNotMatch(automation, /proposal\.fields/);
assert.doesNotMatch(automation, /raw OCR|rawOcr|document\.text/);

console.log("Policy OCR protected worker regression passed.");
