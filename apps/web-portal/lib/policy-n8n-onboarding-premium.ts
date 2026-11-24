import type { N8nVerifiedPremiumBreakdown } from "@/lib/policy-intake-n8n-validation";

/**
 * Canonical Motor form NET = entered OD + add-ons + TP + CPA.
 * ICICI 3005/O prints Basic OD + add-ons - NCB deduction = Total OD.
 * The form has no separate NCB field: carry that verified deduction in the
 * net-of-deductions OD entry, without double-counting the add-ons.
 * NEVER register a policy whose derived net basic OD would be negative.
 */
export function mapVerifiedN8nMotorPremium(p: N8nVerifiedPremiumBreakdown): {
  od: string; addOnPremium: string; tp: string; cpa: string; cpaOpted: "Yes" | "No";
} {
  if (p.tataAig) {
    // Do NOT place legal liability to paid drivers or unnamed-passenger PA
    // inside owner-driver CPA. The booking engine zeros CPA when opted=No.
    // Place every non-owner liability component in the TP bucket instead.
    // Standalone OD roadside assistance is assigned to add-ons, never TP.
    const t = p.tataAig;
    const saod = t.product === "Stand-Alone Own Damage";
    const addOn = t.addonSubtotal + (saod ? t.roadsideAssistance : 0);
    const tp = p.basicTp + t.paidDriverLiability + t.passengerPa
      + (saod ? 0 : t.roadsideAssistance);
    const net = t.postNcbOd + addOn + tp + p.cpa;
    if (![addOn, tp, net, p.cpa, t.postNcbOd, t.printedNet].every(v => Number.isFinite(v) && v >= 0)
      || Math.abs(net - p.net) > 0.04
      || Math.abs(net - t.printedNet) > 1.01
      || Math.abs(p.basicOd - t.ncbDiscount - t.postNcbOd) > 0.03
      || (saod && (p.basicTp !== 0 || p.cpa !== 0))) {
      throw new Error("n8n_motor_premium_handoff_unreconciled");
    }
    const paisa = (value: number) => String(Math.round(value * 100) / 100);
    return {
      od:paisa(t.postNcbOd), addOnPremium:paisa(addOn),
      tp:paisa(tp), cpa:paisa(p.cpa), cpaOpted:p.cpa > 0 ? "Yes" : "No",
    };
  }
  const addons = p.odAddons.reduce((sum, addon) => sum + addon.amount, 0);
  const subtotal = p.odSubtotal ?? p.basicOd + addons;
  const deductions = p.odDeductions ?? 0;
  const matches = (left: number, right: number) => Math.abs(left - right) < 0.01;
  const netBasicOd = p.totalOd - addons;
  if ([p.basicOd, p.totalOd, p.basicTp, p.cpa, p.liability, p.net,
       addons, subtotal, deductions, netBasicOd].some(value => !Number.isFinite(value))
      || [p.basicOd, p.totalOd, p.basicTp, p.cpa, p.liability, p.net,
          addons, subtotal, deductions, netBasicOd].some(value => value < 0)
      || !matches(p.basicOd + addons, subtotal)
      || !matches(subtotal - deductions, p.totalOd)
      || !matches(p.basicTp + p.cpa, p.liability)
      || !matches(p.totalOd + p.liability, p.net)) {
    throw new Error("n8n_motor_premium_handoff_unreconciled");
  }
  // Work in paisa rather than forwarding binary floating-point differences.
  const paisa = (value: number) => String(Math.round(value * 100) / 100);
  return {
    od: paisa(netBasicOd),
    addOnPremium: paisa(addons),
    tp: paisa(p.basicTp),
    cpa: paisa(p.cpa),
    cpaOpted: p.cpa > 0 ? "Yes" : "No",
  };
}


/** Strict Go Digit native PDF commercial totals -> canonical Motor form. These
 * totals have ALREADY passed 18 independent n8n validation checks. Owner-driver
 * and paid-driver liability are inside the printed TP bucket and must not be
 * added a second time as CPA. */
export function mapVerifiedGoDigitCommercialPremium(p: {
  od: number; tp: number; net: number; gst: number; gross: number;
}): ReturnType<typeof mapVerifiedN8nMotorPremium> {
  const money = [p.od, p.tp, p.net, p.gst, p.gross];
  const valid = (v: number) => Number.isFinite(v) && v >= 0 && v <= 1_000_000_000
    && Math.abs(v * 100 - Math.round(v * 100)) < .00001;
  const cents = (v: number) => Math.round(v * 100);
  if (!money.every(valid) || p.od <= 0 || p.tp <= 0
    || Math.abs(cents(p.od + p.tp) - cents(p.net)) > 6
    || Math.abs(cents(p.net + p.gst) - cents(p.gross)) > 6)
    throw new Error("n8n_motor_premium_handoff_unreconciled");
  const paisa = (v: number) => String(Math.round(v * 100) / 100);
  return { od:paisa(p.od), addOnPremium:"0", tp:paisa(p.tp), cpa:"0", cpaOpted:"No" };
}

/** IFFCO Tokio prints Net(B) inclusive of owner-driver PA. Canonical booking
 * separately adds CPA to TP. Split ONLY the source-verified CPA amount out of
 * printed Net(B), without changing OD, printed net/GST/gross or paid-driver LL.
 * Values must have passed the active IFFCO 18-check parser contract first. */
export function mapVerifiedIffcoCommercialPremium(
  p: {od:number; tp:number; net:number; gst:number; gross:number},
  printedCpa:number,
):ReturnType<typeof mapVerifiedN8nMotorPremium> {
  const money=[p.od,p.tp,p.net,p.gst,p.gross,printedCpa];
  const valid=(v:number)=>Number.isFinite(v)&&v>=0&&v<=1_000_000_000
    &&Math.abs(v*100-Math.round(v*100))<.00001;
  const cents=(v:number)=>Math.round(v*100);
  if(!money.every(valid)||p.od<=0||p.tp<=0
    ||cents(printedCpa)>cents(p.tp)
    ||Math.abs(cents(p.od)+cents(p.tp)-cents(p.net))>6
    ||Math.abs(cents(p.net)+cents(p.gst)-cents(p.gross))>6)
    throw new Error("n8n_iffco_cpa_split_unreconciled");
  const canonicalTpCents=cents(p.tp)-cents(printedCpa);
  const value=(v:number)=>String(Math.round(v*100)/100);
  return {od:value(p.od),tp:value(canonicalTpCents/100),addOnPremium:"0",
    cpa:value(printedCpa),cpaOpted:printedCpa>0?"Yes":"No"};
}

/** Read-only printed New India tax reference, for current-PDF verified drafts.
 * This is NOT used to compute or post a booked policy's tax. We cannot
 * recreate a source invoice's rounded mixed-rate GST from 18%/5% estimates.
 * Never accept a generic OCR row or a draft note without matching verified
 * policy number, OD, TP, exact queue fingerprint and current document. */
export type NiaPrintedPremiumReference = {
  od:number; tp:number; net:number; gst:number; gross:number;
};
export function readVerifiedNiaPrintedPremiumReference(input:{
  parserId:string|null; checksPassed:number; currentPdfVerified:boolean;
  remarks:string; policyNumber:string;
  fields:readonly {key:string;value:string}[];
}):NiaPrintedPremiumReference|null {
  if(input.parserId!=="new_india_cv_native_pdf"
    ||input.checksPassed!==16||!input.currentPdfVerified)return null;
  const m=input.remarks.match(/independently validated commercial-motor PDF \(new_india_cv_native_pdf\)\.[\s\S]*?Printed OD ([\d.]+), TP including liabilities ([\d.]+), Net ([\d.]+), GST ([\d.]+), Gross ([\d.]+)\./i);
  if(!m)return null;
  const [od,tp,net,gst,gross]=m.slice(1).map(Number);
  const valid=(v:number)=>Number.isFinite(v)&&v>=0&&v<=1_000_000_000
    &&Math.abs(v*100-Math.round(v*100))<.00001;
  const cents=(v:number)=>Math.round(v*100);
  const get=(key:string)=>input.fields.filter(f=>f.key===key).map(f=>f.value.trim());
  if(![od,tp,net,gst,gross].every(valid)
    ||cents(od+tp)!==cents(net)||cents(net+gst)!==cents(gross)
    ||get("policy_number").length!==1
    ||get("policy_number")[0]!==input.policyNumber
    ||get("od_premium").length!==1 ||cents(Number(get("od_premium")[0]))!==cents(od)
    ||get("tp_premium").length!==1 ||cents(Number(get("tp_premium")[0]))!==cents(tp))
    return null;
  return {od,tp,net,gst,gross};
}

/** Verified CPA amount and saved owner-driver opt-in must agree before booking.
 * A positive numeric field alone cannot turn an operator's saved "No" into Yes.
 * In particular, canonical booking zeros out CPA whenever opted is false. */
export function verifiedCpaSelectionMatches(
  savedOpted: "Yes" | "No", verifiedCpa: number,
): boolean {
  return Number.isFinite(verifiedCpa) && verifiedCpa >= 0
    && (savedOpted === "Yes") === (verifiedCpa > 0);
}


/** New India package GCV: printed Total TP INCLUDES owner-driver CPA.
 * n8n certifies the labelled Basic TP + CPA + paid-driver LL rows AND the
 * two printed 18%/5% GST bases before cpa_premium is emitted. Canonical form
 * must enter CPA separately, subtract it from printed total TP exactly once,
 * and retain the paid-driver liability in the remaining TP bucket.
 * Never derive CPA by subtracting arbitrary amounts from the TP total. */
export function mapVerifiedNiaCommercialPremium(
  printed: {od:number;tp:number;net:number;gst:number;gross:number},
  sourceVerifiedCpa: number,
):ReturnType<typeof mapVerifiedN8nMotorPremium>{
  const cents=(v:number)=>Math.round(v*100);
  const values=[printed.od,printed.tp,printed.net,printed.gst,printed.gross,sourceVerifiedCpa];
  if(!values.every(v=>Number.isFinite(v)&&v>=0&&v<=1_000_000_000
      &&Math.abs(v*100-cents(v))<0.00001)
    ||sourceVerifiedCpa<=0||sourceVerifiedCpa>=printed.tp
    ||printed.od<=0||printed.tp<=0||printed.gross<=0
    ||Math.abs(cents(printed.od)+cents(printed.tp)-cents(printed.net))>6
    ||Math.abs(cents(printed.net)+cents(printed.gst)-cents(printed.gross))>6)
    throw new Error("nia_printed_cpa_split_unreconciled");
  const asMoney=(v:number)=>String(cents(v)/100);
  const tpWithoutCpa=(cents(printed.tp)-cents(sourceVerifiedCpa))/100;
  return {od:asMoney(printed.od),addOnPremium:"0",tp:asMoney(tpWithoutCpa),
    cpa:asMoney(sourceVerifiedCpa),cpaOpted:"Yes"};
}

/** United India GCV source-certified CPA is already inside printed Gross TP(B).
 * Called only AFTER assessUiicGcvDirectConversion verifies the source-labelled
 * CPA, named authority, complete vehicle fields and mixed GST. Split CPA
 * exactly once to preserve the canonical Motor form's OD+TP+CPA=NET rule.
 * No inferred CPA and no review bypass.
 */
export function mapVerifiedUiicGcvCommercialPremium(
  printed:{od:number;tp:number;net:number;gst:number;gross:number},
  sourceVerifiedCpa:number,
):ReturnType<typeof mapVerifiedN8nMotorPremium>{
  return mapVerifiedIffcoCommercialPremium(printed,sourceVerifiedCpa);
}
