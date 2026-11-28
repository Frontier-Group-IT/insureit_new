/**
 * Read-only safety gate shared by fresh PDF requeue and explicit draft reparse.
 *
 * A current original PDF may be read again, but not while a prior automatic
 * booking outcome may have committed. Claims and recovery attempts are
 * immutable, independent ledgers; even a current queue marked "verified"
 * is not evidence that a previous booking transaction was rolled back.
 *
 * This gate does not authorize booking or automatically retry anything.
 */
export const AI_BOOKING_REPROCESS_LEDGERS = [
  "policy_intake_ai_auto_booking_attempts",
  "policy_intake_ai_auto_booking_recovery_attempts",
  "policy_intake_ai_canonical_recovery_attempts",
  "policy_intake_ai_icici_recovery_attempts",
  "policy_intake_ai_icici_uncertain_recovery_attempts",
  "policy_intake_ai_reconciled_recovery_attempts",
  "policy_intake_ai_uiic_tractor_recovery_attempts",
  "policy_intake_ai_stranded_claim_recovery",
] as const;

export type AiBookingReprocessLedger = typeof AI_BOOKING_REPROCESS_LEDGERS[number];
export type AiBookingLedgerSnapshot = {state:string|null;error:boolean};
export type AiBookingReprocessHold =
  "booking_reconciliation_required"|"booking_ledger_unavailable"|null;

/**
 * Fail closed on missing/unreadable ledgers. In particular, an `uncertain`
 * recovery attempt is terminal even if the original attempt says reviewed.
 * Review-required pre-commit source corrections are intentionally not blocked.
 */
export async function checkAiBookingReprocessHold(
  read: (ledger:AiBookingReprocessLedger)=>Promise<AiBookingLedgerSnapshot>,
):Promise<AiBookingReprocessHold>{
  let results:AiBookingLedgerSnapshot[];
  try {
    results=await Promise.all(AI_BOOKING_REPROCESS_LEDGERS.map(ledger=>read(ledger)));
  } catch {
    return "booking_ledger_unavailable";
  }
  if(results.length!==AI_BOOKING_REPROCESS_LEDGERS.length
    ||results.some(result=>!result||result.error))
    return "booking_ledger_unavailable";
  if(results.some(result=>result.state==="claimed"
    ||result.state==="uncertain"||result.state==="booked"))
    return "booking_reconciliation_required";
  return null;
}
