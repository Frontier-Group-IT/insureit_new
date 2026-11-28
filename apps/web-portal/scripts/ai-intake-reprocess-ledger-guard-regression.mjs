import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  AI_BOOKING_REPROCESS_LEDGERS,
  checkAiBookingReprocessHold,
} from "../lib/ai-intake-reprocess-ledger-guard.ts";

const original = "policy_intake_ai_auto_booking_attempts";
assert.ok(AI_BOOKING_REPROCESS_LEDGERS.includes(original));
assert.ok(AI_BOOKING_REPROCESS_LEDGERS.includes("policy_intake_ai_reconciled_recovery_attempts"));
assert.ok(AI_BOOKING_REPROCESS_LEDGERS.includes("policy_intake_ai_uiic_tractor_recovery_attempts"));
assert.ok(AI_BOOKING_REPROCESS_LEDGERS.includes("policy_intake_ai_icici_uncertain_recovery_attempts"));

const readStates=async(states={},errorTable=null)=>{
  const seen=[];
  const hold=await checkAiBookingReprocessHold(async table=>{
    seen.push(table);
    return {state:states[table]??null,error:table===errorTable};
  });
  assert.deepEqual(seen.slice().sort(),AI_BOOKING_REPROCESS_LEDGERS.slice().sort(),
    "Every original/recovery ledger must be consulted even when another already blocks");
  return hold;
};

assert.equal(await readStates(),null);
assert.equal(await readStates({[original]:"review_required"}),null,
  "A pre-commit review may be reparsed after separate checks");
for(const state of ["claimed","uncertain","booked"]){
  assert.equal(await readStates({[original]:state}),"booking_reconciliation_required");
  for(const table of AI_BOOKING_REPROCESS_LEDGERS){
    assert.equal(await readStates({[table]:state}),"booking_reconciliation_required",
      `Ledger ${table} must block ${state}`);
  }
}
assert.equal(await readStates({},original),"booking_ledger_unavailable");
assert.equal(await checkAiBookingReprocessHold(async()=>{throw Error("network down");}),
  "booking_ledger_unavailable");

const source=readFileSync(new URL("../app/development/ai-policy-onboarding/actions.ts",import.meta.url),"utf8");
const first=source.indexOf("export async function reprocessAiPolicyIntake(");
const second=source.indexOf("export async function reparseAndReplaceAiPolicyIntakeDraft(");
assert.ok(first>0&&second>first);
assert.ok(source.slice(first,second).includes("await aiReprocessBookingLedgerError(id)"));
assert.ok(source.slice(second,second+2700).includes("await aiReprocessBookingLedgerError(id)"));
assert.ok(source.includes("if(bookingHold)return{ok:false,error:bookingHold};"));
console.log("AI intake reprocess/reparse immutable-ledger holds verified");
