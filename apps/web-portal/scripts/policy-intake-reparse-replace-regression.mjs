import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const actions=read("../app/development/ai-policy-onboarding/actions.ts");
const handoff=read("../app/policy-intakes/handoff-actions.ts");
const preview=read("../lib/policy-intake-semi-auto-n8n.ts");
const ui=read("../components/development/semi-auto-policy-workspace.tsx");

const action=actions.slice(actions.indexOf("export async function reparseAndReplaceAiPolicyIntakeDraft"),
  actions.indexOf("export async function applySemiAutoN8nIntake"));
assert(action.includes('intake.final_policy_id'),"Booked policies remain protected");
assert(action.includes('duplicate.matches.has(id)'),"Duplicate intakes remain protected");
assert(action.includes('prepareVerifiedN8nIntakeHandoff('),"The current PDF is freshly parsed via n8n");
assert(!action.includes('processing_lane:'),"Reparse must not silently change the Intake's processing lane");
assert(handoff.includes('ocr_fields:verified.fields'),"Successful reparse replaces active OCR fields");
assert(handoff.includes('draft_payload:draft,revision:existingDraft.revision+1'),"Successful reparse replaces the saved draft under revision control");
assert(handoff.includes('issuanceDate:verified?(verifiedIssuanceDate||approvedSigningDate):""'),"Missing issuance evidence never defaults to today");
assert(handoff.includes('allowManualLane:replaceExistingDraft'),"Explicit operator action can reparse manual-lane intakes");
assert(preview.includes('options.allowManualLane === true'),"Only explicit reparse enables the manual-lane exception");
assert(ui.includes('Reparse & replace saved draft'),"Exception dialog exposes the one-click action");
const reprocessPanel=ui.slice(ui.indexOf("Queue the current private PDF")>=0?ui.indexOf("Queue the current private PDF"):ui.indexOf("Re-read the current PDF using n8n"));
assert(reprocessPanel.includes("reparseAndReplaceAiPolicyIntakeDraft(row.id)"),
  "Reprocess-current-PDF must replace verified parser-owned OCR and draft, not just enqueue");
assert(reprocessPanel.includes("Reprocess current PDF & replace draft"),
  "Button must explicitly describe its replacement behavior");

assert(ui.includes('Reparse & replace'),"Open Motor intake rows expose the one-click action");
assert(ui.includes('does not create or book a policy'),"The action communicates its booking boundary");
console.log("Policy Intake reparse-and-replace guards, UI, current PDF and draft overwrite: passed");
