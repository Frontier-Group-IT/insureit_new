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
