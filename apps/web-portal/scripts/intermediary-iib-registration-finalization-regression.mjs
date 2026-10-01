import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const actions = readFileSync(new URL("../app/intermediaries/applications/iib-submission-actions.ts", import.meta.url), "utf8");
const stage = readFileSync(new URL("../app/intermediaries/applications/iib-submission-stage.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../../../supabase/migrations/20261001170000_complete_intermediary_iib_registration.sql", import.meta.url), "utf8");
const deployProduction = readFileSync(new URL("../../../.github/workflows/deploy-production.yml", import.meta.url), "utf8");
const applyMigration = readFileSync(new URL("../../../.github/workflows/apply-intermediary-iib-registration-finalizer.yml", import.meta.url), "utf8");

assert.match(stage, /completeIntermediaryIibRegistration/, "Step 6 must wire the registration-completion server action.");
assert.match(stage, /packet\?\.status === "handoff_started"/, "Completion must stay unavailable until portal handoff has started.");
assert.match(stage, /Complete IIB Registration/, "Step 6 must expose a clear completion action after handoff.");
assert.match(stage, /name="confirm_iib_registration"[\s\S]*required/, "Completion must require an explicit confirmation checkbox.");
assert.match(stage, /name="registered_on"[\s\S]*required/, "Completion must capture the IIB registration date.");
assert.match(stage, /name="iib_reference"/, "Completion must support an optional IIB reference.");
assert.match(stage, /Registered · Active/, "Completed IIB state must make activation visible.");

assert.match(actions, /export async function completeIntermediaryIibRegistration/, "A dedicated server action must finalize IIB registration.");
assert.match(actions, /confirm_iib_registration[^\n]+!== "yes"/, "The server must independently enforce confirmation.");
assert.match(actions, /admin\.rpc\("complete_intermediary_iib_registration"/, "The server action must use the atomic database finalizer.");
assert.match(actions, /if \(applicationError \|\| packetError\)/, "IIB preparation must fail if either coordinated write fails.");
assert.match(actions, /if \(applicationError \|\| packetError\)/g, "IIB handoff must also fail if either coordinated write fails.");
assert.doesNotMatch(actions, /applicationError && packetError/, "Preparation must not silently accept one failed write.");
assert.doesNotMatch(actions, /applicationError && \(!packet \|\| packetError\)/, "Handoff must not silently accept one failed write.");
assert.match(
  actions,
  /intermediary_iib_submission_packets"\)\.upsert\([\s\S]*status: "handoff_started"[\s\S]*onConflict: "application_id"/,
  "Draft-backed handoff must upsert a canonical packet before registration can be finalized.",
);

assert.match(migration, /create or replace function public\.complete_intermediary_iib_registration/, "Migration must create the atomic finalizer.");
assert.match(migration, /training_status <> 'completed'/, "Finalizer must recheck training completion.");
assert.match(migration, /exam_status <> 'passed'/, "Finalizer must recheck exam pass status.");
assert.match(migration, /agreement_status <> 'signed'/, "Finalizer must recheck signed agreement.");
assert.match(migration, /v_packet\.status not in \('handoff_started', 'submitted', 'registered'\)/, "Finalizer must require an actual portal handoff or later state.");
assert.match(migration, /cardinality\(coalesce\(v_packet\.missing_fields/, "Finalizer must reject incomplete IIB packets.");
assert.match(
  migration,
  /update public\.intermediary_onboarding_applications[\s\S]*registration_record_id = coalesce\(registration_record_id, v_registration_id\)/,
  "Finalizer must restore a recovered registration ID on the onboarding application.",
);
assert.match(migration, /status = 'registered'/, "Finalizer must mark the packet registered.");
assert.match(migration, /iib_registration_status = 'registered'/, "Finalizer must mark assignment IIB registration registered.");
assert.match(migration, /registration_status = 'iib_registered'/, "Finalizer must move the application/registration to IIB registered.");
assert.match(migration, /workflow_stage = 'completed'/, "Finalizer must complete the onboarding profile.");
assert.match(migration, /iib_uploaded = true/, "Finalizer must record completed IIB upload state.");
assert.match(migration, /account_status = 'active'/, "Finalizer must activate the intermediary account.");
assert.match(migration, /iib_status = 'cleared'/, "Finalizer must clear intermediary IIB compliance state.");
assert.match(migration, /compliance_status = 'approved'/, "Finalizer must approve intermediary compliance state.");
assert.match(migration, /grant execute on function public\.complete_intermediary_iib_registration[\s\S]*to service_role/, "Finalizer must be callable only from the trusted server path.");

assert.match(
  deployProduction,
  /20261001170000_complete_intermediary_iib_registration\.sql[\s\S]*apply-intermediary-iib-registration-finalizer\.yml/,
  "Production deployment must wait for the dedicated IIB finalizer schema workflow.",
);
assert.match(applyMigration, /20261001170000_complete_intermediary_iib_registration\.sql/, "Dedicated schema workflow must apply the IIB finalizer migration.");
assert.match(applyMigration, /20261001170000/, "Dedicated schema workflow must verify the exact IIB migration version.");
assert.match(applyMigration, /complete_intermediary_iib_registration\(uuid,uuid,text,date\)/, "Dedicated schema workflow must verify the finalizer function contract.");

console.log("Intermediary IIB registration finalization regression passed.");
