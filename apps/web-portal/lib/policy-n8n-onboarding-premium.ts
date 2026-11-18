import type { N8nVerifiedPremiumBreakdown } from "@/lib/policy-intake-n8n-validation";

/**
 * Canonical Motor form NET = basic OD + add-on + TP + CPA.
 * n8n validates Total OD independently; never put Total OD into the Basic OD
 * field or separately adding add-ons would overstate the bookable premium.
 */
export function mapVerifiedN8nMotorPremium(p: N8nVerifiedPremiumBreakdown): {
  od: string; addOnPremium: string; tp: string; cpa: string; cpaOpted: "Yes" | "No";
} {
  const addons=p.odAddons.reduce((sum,addon)=>sum+addon.amount,0);
  const matches=(left:number,right:number)=>Math.abs(left-right)<0.01;
  const odOnly=p.printedOdSubtotal!==undefined || p.odDeductions!==undefined;
  if (odOnly) {
    const subtotal=p.printedOdSubtotal, deduction=p.odDeductions;
    // Canonical Motor form represents net = OD input + add-ons + TP + CPA.
    // For a standalone OD policy, its OD input must be the *discounted*
    // Basic OD amount, not the printed gross Basic OD before NCB.
    // This preserves both the add-ons and the payable net without double counting.
    if (subtotal===undefined || deduction===undefined
        || [subtotal,deduction,p.basicOd,p.totalOd,addons].some(v=>!Number.isFinite(v)||v<0)
        || deduction>p.basicOd || !matches(p.basicOd+addons,subtotal)
        || !matches(subtotal-deduction,p.totalOd)
        || !matches(p.net,p.totalOd)
        || !matches(p.basicTp,0)||!matches(p.cpa,0)||!matches(p.liability,0)
        || !matches(p.net+p.tax,p.gross)) throw new Error("n8n_od_only_premium_handoff_unreconciled");
    return {
      od:String(Math.round((p.basicOd-deduction)*100)/100),
      addOnPremium:String(addons),tp:"0",cpa:"0",cpaOpted:"No"
    };
  }
  if([p.basicOd,p.totalOd,p.basicTp,p.cpa,p.liability,p.net,addons].some(value=>!Number.isFinite(value)||value<0)
      || !matches(p.basicOd+addons,p.totalOd)
      || !matches(p.basicTp+p.cpa,p.liability)
      || !matches(p.totalOd+p.liability,p.net)) {
    throw new Error("n8n_motor_premium_handoff_unreconciled");
  }
  return {
    od:String(p.basicOd),addOnPremium:String(addons),
    tp:String(p.basicTp),cpa:String(p.cpa),
    cpaOpted:p.cpa>0?"Yes":"No",
  };
}
