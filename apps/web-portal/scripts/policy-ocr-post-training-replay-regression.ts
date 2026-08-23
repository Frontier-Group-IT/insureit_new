import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actions = readFileSync("app/system/policy-ocr-training/actions.ts", "utf8");
const page = readFileSync("app/system/policy-ocr-training/page.tsx", "utf8");
const runner = readFileSync("app/system/policy-ocr-training/post-training-runner.tsx", "utf8");
const migration = readFileSync("../../supabase/migrations/20260823212000_policy_ocr_post_training_replay.sql", "utf8");

const replayStart = actions.indexOf("export async function processNextProductionOcrPostTrainingBatch");
const replayEnd = actions.indexOf("async function failPostTrainingReplay", replayStart);
assert.ok(replayStart >= 0 && replayEnd > replayStart, "post-training replay action must exist");
const replay = actions.slice(replayStart, replayEnd);

assert.match(replay, /\.eq\("cohort_role", "training"\)/);
assert.match(replay, /\.eq\("truth_status", "verified"\)/);
assert.match(replay, /post_training_proposal/);
assert.match(replay, /post_training_metrics/);
assert.match(replay, /post_training_field_results/);
assert.match(replay, /extractPolicyDocument\(input\)/);
assert.match(replay, /compareTruth\(proposal, reference, truth\)/);
assert.doesNotMatch(replay, /processPolicyOcrTrainingDocument/);
assert.doesNotMatch(replay, /\.from\("policy_ocr_training_labels"\)\s*\.update/);
assert.doesNotMatch(replay, /baseline_proposal\s*:/);
assert.doesNotMatch(replay, /baseline_metrics\s*:/);

assert.match(migration, /post_training_status text not null default 'pending'/);
assert.match(migration, /post_training_proposal jsonb/);
assert.match(migration, /post_training_metrics jsonb/);
assert.match(migration, /post_training_field_results jsonb/);
assert.match(migration, /Blind holdouts remain untouched/);

assert.match(runner, /Replay all/);
assert.match(runner, /processNextProductionOcrPostTrainingBatch/);
assert.match(page, /PostTrainingRunner/);
assert.match(page, /Blind holdouts stay sealed/);
assert.match(page, /post_training_metrics/);

console.log("Policy OCR post-training replay regression: non-destructive training-only replay contract passed.");
