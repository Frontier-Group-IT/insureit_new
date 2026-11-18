import type { PolicyIntakeDraft } from "@/app/policy-intakes/handoff-actions";
import type { N8nOcrField, N8nVerifiedPremiumBreakdown } from "@/lib/policy-intake-n8n-validation";
import { buildPolicyOcrOnboardingUpdate } from "@/lib/policy-ocr-onboarding-apply";
import { enrichVerifiedN8nOnboardingFields } from "@/lib/policy-n8n-onboarding-enrichment";
import { mapVerifiedN8nMotorPremium } from "@/lib/policy-n8n-onboarding-premium";

/** PDF-sourced fields which may be changed ONLY after a reviewer has seen the
 * old/new values and explicitly selected each change. Customer identity,
 * source/RM, payout, invoice and approval fields are deliberately excluded. */
export const RECONCILABLE_FIELDS = [
  "issuanceDate","policyNo","validFrom","validUpto","tpValidUpto",
  "insurerId","policyProduct","idv","od","addOnPremium","tp","cpa","cpaOpted",
  "vehicleClass","make","model","fuelType","capacity","manufacturingYear",
  "rtoState","rtoName","chassisNo","engineNo",
] as const satisfies readonly (keyof PolicyIntakeDraft)[];
export type ReconciliableField = typeof RECONCILABLE_FIELDS[number];
export type DraftDifference = {
  key: ReconciliableField; label: string;
  savedValue: string; verifiedPdfValue: string; wasBlank: boolean;
};
const LABELS: Record<ReconciliableField,string> = {
  issuanceDate:"Policy issued on",policyNo:"Policy number",
  validFrom:"OD valid from",validUpto:"OD valid up to",tpValidUpto:"TP reference valid up to",
  insurerId:"Insurance company (master ID)",policyProduct:"Policy product",
  idv:"Vehicle IDV",od:"Basic OD (net of verified deductions)",
  addOnPremium:"OD add-ons",tp:"Third-party charge",cpa:"CPA charge",
  cpaOpted:"CPA opted",vehicleClass:"Vehicle class",make:"Manufacturer",
  model:"Vehicle model",fuelType:"Fuel",capacity:"Motor kW / CC",
  manufacturingYear:"Manufacturing year",rtoState:"RTO state",rtoName:"RTO city",
  chassisNo:"Chassis number",engineNo:"Engine number",
};
const string = (value:unknown)=>String(value??"").trim();
const numeric = new Set<ReconciliableField>(["idv","od","addOnPremium","tp","cpa","capacity"]);
function equivalent(key:ReconciliableField,a:string,b:string):boolean{
  if(numeric.has(key)&&a!==""&&b!==""&&Number.isFinite(Number(a))&&Number.isFinite(Number(b)))
    return Math.round(Number(a)*100)===Math.round(Number(b)*100);
  return a===b;
}
export function projectVerifiedPdfFields(
  fields: readonly N8nOcrField[], premium:N8nVerifiedPremiumBreakdown,
  manufacturers: readonly string[], insurers: readonly {value:string;label:string}[],
):Partial<Record<ReconciliableField,string>> {
  const enriched=enrichVerifiedN8nOnboardingFields(fields);
  const map=new Map(fields.map(f=>[f.key,f.value.trim()]));
  const base={
    registrationNo:"",vehicleClass:"",make:"",model:"",fuelType:"",
    manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",rtoState:"",
    rtoName:"",policyProduct:"",idv:"",od:"",tp:"",cpa:"",
    policyNo:"",insurerId:"",validFrom:"",validUpto:"",
  };
  const mapped=buildPolicyOcrOnboardingUpdate({
    mode:"create",registrationMode:"registered",current:base,
    fields:enriched,manufacturers:[...manufacturers],
    insurers:[...insurers],rcVerified:false,
  });
  const money=mapVerifiedN8nMotorPremium(premium);
  return {
    issuanceDate:map.get("policy_issuance_date")??"",
    policyNo:map.get("policy_number")??"",
    validFrom:map.get("policy_start_date")??"",
    validUpto:map.get("policy_end_date")??"",
    tpValidUpto:map.get("third_party_end_date")??"",
    insurerId:mapped.next.insurerId,policyProduct:mapped.next.policyProduct,
    idv:mapped.next.idv,od:money.od,addOnPremium:money.addOnPremium,
    tp:money.tp,cpa:money.cpa,cpaOpted:money.cpaOpted,
    vehicleClass:mapped.next.vehicleClass,make:mapped.next.make,
    model:mapped.next.model,fuelType:mapped.next.fuelType,
    capacity:mapped.next.capacity,manufacturingYear:mapped.next.manufacturingYear,
    rtoState:mapped.next.rtoState,rtoName:mapped.next.rtoName,
    chassisNo:mapped.next.chassisNo,engineNo:mapped.next.engineNo,
  };
}
export function findVerifiedDraftDifferences(
  current:PolicyIntakeDraft, projected:Partial<Record<ReconciliableField,string>>,
):DraftDifference[] {
  return RECONCILABLE_FIELDS.flatMap(key=>{
    const savedValue=string(current[key]);
    const verifiedPdfValue=string(projected[key]);
    if(!verifiedPdfValue||equivalent(key,savedValue,verifiedPdfValue))return [];
    return [{key,label:LABELS[key],savedValue,verifiedPdfValue,wasBlank:!savedValue}];
  });
}
