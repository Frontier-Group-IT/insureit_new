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

/** Verified CPA amount and saved owner-driver opt-in must agree before booking.
 * A positive numeric field alone cannot turn an operator's saved "No" into Yes.
 * In particular, canonical booking zeros out CPA whenever opted is false. */
export function verifiedCpaSelectionMatches(
  savedOpted: "Yes" | "No", verifiedCpa: number,
): boolean {
  return Number.isFinite(verifiedCpa) && verifiedCpa >= 0
    && (savedOpted === "Yes") === (verifiedCpa > 0);
}
