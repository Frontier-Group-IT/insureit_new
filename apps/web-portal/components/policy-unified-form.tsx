"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { lookupPolicyRegistrationRc, type PolicyRcReview } from "@/app/policies/authbridge-rc-actions";
import { updatePolicyOnboarding, type PolicyEditPayload } from "@/app/policies/policy-edit-actions";
import {
  onboardPolicy,
  type PolicyCustomerCandidate,
  type PolicyOnboardingPayload,
  type PolicyOwnershipConflict,
} from "@/app/policies/policy-onboarding-actions";
import { PolicyOcrImportPanel } from "@/components/policy-ocr-import-panel";
import { PolicyPayinBillingFields } from "@/components/policy-payin-billing-fields";

export type PolicyFormMode = "create" | "edit";
export type PolicySourceOption = {
  type: "POSP" | "MISP" | "SIBL / Partner";
  value: string;
  label: string;
  code: string;
  rmName: string;
  rmCode: string;
};
export type PolicyRmOption = { value: string; label: string };
export type PolicyUnifiedInitialValues = {
  policyId?: string;
  policyCode?: string;
  issuanceDate?: string;
  rmName?: string;
  intermediaryType?: string;
  leadSource?: string;
  intermediaryCode?: string;
  businessLine?: string;
  registrationNo?: string;
  insuredName?: string;
  phoneNo?: string;
  vehicleClass?: string;
  make?: string;
  model?: string;
  fuelType?: string;
  capacity?: string;
  manufacturingYear?: string;
  chassisNo?: string;
  engineNo?: string;
  rtoState?: string;
  rtoName?: string;
  policyProduct?: string;
  idv?: string;
  od?: string;
  tp?: string;
  cpaOpted?: "Yes" | "No";
  cpa?: string;
  policyNo?: string;
  insurerId?: string;
  validFrom?: string;
  validUpto?: string;
  payoutBasis?: string;
  projectedOdPercent?: string;
  projectedTpPercent?: string;
  insurerScheme?: string;
  payinBillNo?: string;
  payinBilledAmount?: string;
  payinBillDate?: string;
  payinStatus?: string;
  retention?: string;
  payoutOdPercent?: string;
  payoutTpPercent?: string;
  payoutStatus?: string;
  payoutDate?: string;
  payoutVoucherNo?: string;
  remarks?: string;
};

type SelectOption = { label: string; value: string };
type Props = {
  mode: PolicyFormMode;
  insurers: SelectOption[];
  rms: PolicyRmOption[];
  sources: PolicySourceOption[];
  initialValues?: PolicyUnifiedInitialValues;
};

type FormState = Required<Omit<PolicyUnifiedInitialValues, "policyId" | "policyCode">>;
type ApplyGroups = { ownerIdentity: boolean; ownerAddress: boolean; vehicleIdentity: boolean; technical: boolean; compliance: boolean; finance: boolean };

const defaultGroups: ApplyGroups = { ownerIdentity: true, ownerAddress: true, vehicleIdentity: true, technical: true, compliance: true, finance: true };
const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:border-[#E3E8EF] disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const sections = ["Source", "Customer & Vehicle", "Policy & Premium", "Insurer Pay-in", "Partner Payout"];
const vehicleClassMap: Record<string, { description: string; capacityLabel: string }> = {
  PCP: { description: "Private Car", capacityLabel: "CC" },
  TWP: { description: "Two Wheeler", capacityLabel: "CC" },
  GCV: { description: "Goods Carrying Vehicle", capacityLabel: "GVW" },
  PCV: { description: "Passenger Carrying Vehicle", capacityLabel: "Seating Capacity" },
  MISD: { description: "Miscellaneous Vehicle", capacityLabel: "Category / CC" },
  CPM: { description: "Contractor Plant & Machinery", capacityLabel: "Equipment Capacity" },
};

function today() { return new Date().toISOString().slice(0, 10); }
function stateFrom(values?: PolicyUnifiedInitialValues): FormState {
  return {
    issuanceDate: values?.issuanceDate ?? today(), rmName: values?.rmName ?? "", intermediaryType: values?.intermediaryType ?? "", leadSource: values?.leadSource ?? "", intermediaryCode: values?.intermediaryCode ?? "", businessLine: values?.businessLine ?? "Motor",
    registrationNo: values?.registrationNo ?? "", insuredName: values?.insuredName ?? "", phoneNo: values?.phoneNo ?? "", vehicleClass: values?.vehicleClass ?? "", make: values?.make ?? "", model: values?.model ?? "", fuelType: values?.fuelType ?? "", capacity: values?.capacity ?? "", manufacturingYear: values?.manufacturingYear ?? "", chassisNo: values?.chassisNo ?? "", engineNo: values?.engineNo ?? "", rtoState: values?.rtoState ?? "", rtoName: values?.rtoName ?? "",
    policyProduct: values?.policyProduct ?? "", idv: values?.idv ?? "", od: values?.od ?? "", tp: values?.tp ?? "", cpaOpted: Number(values?.cpa ?? 0)>0?"Yes":"No", cpa: values?.cpa ?? "", policyNo: values?.policyNo ?? "", insurerId: values?.insurerId ?? "", validFrom: values?.validFrom ?? "", validUpto: values?.validUpto ?? "",
    payoutBasis: values?.payoutBasis ?? "NET", projectedOdPercent: values?.projectedOdPercent ?? "", projectedTpPercent: values?.projectedTpPercent ?? "", insurerScheme: values?.insurerScheme ?? "", payinBillNo: values?.payinBillNo ?? "", payinBilledAmount: values?.payinBilledAmount ?? "", payinBillDate: values?.payinBillDate ?? "", payinStatus: values?.payinStatus ?? "Unbilled", retention: values?.retention ?? "", payoutOdPercent: values?.payoutOdPercent ?? "", payoutTpPercent: values?.payoutTpPercent ?? "", payoutStatus: values?.payoutStatus ?? "Pending", payoutDate: values?.payoutDate ?? "", payoutVoucherNo: values?.payoutVoucherNo ?? "", remarks: values?.remarks ?? "",
  };
}
function classifyVehicle(value: string | null) { const text=(value??"").toLowerCase(); if(/two.?wheel|motor.?cycle|scooter/.test(text))return"TWP"; if(/goods|truck|cargo/.test(text))return"GCV"; if(/passenger|bus|taxi|cab/.test(text))return"PCV"; if(/plant|machinery|excavator|construction/.test(text))return"CPM"; if(/motor car|private|car|lmv/.test(text))return"PCP"; return"MISD"; }
function titleCase(value: string | null) { return value ? value.toLowerCase().replace(/\b\w/g,(c)=>c.toUpperCase()) : ""; }
function normalizeFuel(value: string | null) { const v=(value??"").toUpperCase(); if(v.includes("PETROL"))return"Petrol"; if(v.includes("DIESEL"))return"Diesel"; if(v.includes("CNG"))return"CNG"; if(v.includes("ELECTRIC"))return"Electric"; if(v.includes("HYBRID"))return"Hybrid"; if(v.includes("BI"))return"Bi-Fuel"; return value?"Other":""; }
function capacityFor(review: PolicyRcReview, vehicleClass: string) { if(vehicleClass==="PCP"||vehicleClass==="TWP")return review.engineCapacity??""; if(vehicleClass==="PCV")return review.seatingCapacity??""; if(vehicleClass==="GCV"||vehicleClass==="CPM")return review.grossWeight??""; return review.vehicleCategory??review.engineCapacity??review.grossWeight??""; }
function isoDate(value: string | null) { if(!value||value==="NA")return""; if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value; const match=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); return match?`${match[3]}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`:""; }
function boolValue(value: string | null) { return value==="true"||value==="Yes"||value==="YES"; }

export function PolicyUnifiedForm({ mode, insurers, rms, sources, initialValues }: Props) {
  const router = useRouter();
  const [form,setForm]=useState<FormState>(()=>stateFrom(initialValues));
  const [remarksOpen,setRemarksOpen]=useState(()=>Boolean(initialValues?.remarks));
  const [activeSection,setActiveSection]=useState(0);
  const [rcReview,setRcReview]=useState<PolicyRcReview|null>(null);
  const [appliedRc,setAppliedRc]=useState<PolicyRcReview|null>(null);
  const [applyGroups,setApplyGroups]=useState<ApplyGroups>(defaultGroups);
  const [lookupError,setLookupError]=useState<string|null>(null);
  const [submitError,setSubmitError]=useState<string|null>(null);
  const [customerCandidates,setCustomerCandidates]=useState<PolicyCustomerCandidate[]|null>(null);
  const [ownershipConflict,setOwnershipConflict]=useState<PolicyOwnershipConflict|null>(null);
  const [pendingPayload,setPendingPayload]=useState<PolicyOnboardingPayload|null>(null);
  const [isLookingUp,startLookup]=useTransition();
  const [isSubmitting,startSubmit]=useTransition();
  const isEdit=mode==="edit";

  const sectionProgress=useMemo(()=>{
    const groups=[
      [form.issuanceDate,form.businessLine,form.intermediaryType,form.leadSource,form.rmName,form.intermediaryCode],
      [form.registrationNo,form.insuredName,form.phoneNo,form.vehicleClass,form.make,form.model,form.fuelType,form.manufacturingYear,form.capacity,form.chassisNo,form.engineNo,form.rtoState,form.rtoName],
      [form.policyProduct,form.policyNo,form.insurerId,form.idv,form.od,form.tp,form.validFrom,form.validUpto],
      [form.projectedOdPercent,form.projectedTpPercent],
      [form.payoutOdPercent,form.payoutTpPercent,form.payoutStatus],
    ];
    return groups.map(values=>{const filled=values.filter(value=>String(value??"").trim()!=="").length;return{filled,total:values.length,complete:filled===values.length,empty:filled===0,remaining:values.length-filled};});
  },[form]);

  function goToSection(index:number){setActiveSection(index);document.getElementById(`policy-section-${index+1}`)?.scrollIntoView({behavior:"smooth",block:"start"});}

  useEffect(()=>{
    const elements=sections.map((_,index)=>document.getElementById(`policy-section-${index+1}`)).filter((item):item is HTMLElement=>Boolean(item));
    if(!elements.length)return;
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top);
      if(visible[0]){const index=Number((visible[0].target as HTMLElement).dataset.sectionIndex??0);setActiveSection(index);}
    },{rootMargin:"-145px 0px -58% 0px",threshold:[0,.05,.2]});
    elements.forEach(element=>observer.observe(element));
    return()=>observer.disconnect();
  },[]);

  useEffect(()=>{ if(!rcReview&&!customerCandidates&&!ownershipConflict)return; const previous=document.body.style.overflow; document.body.style.overflow="hidden"; const close=(event:KeyboardEvent)=>{if(event.key==="Escape"){setRcReview(null);setCustomerCandidates(null);setOwnershipConflict(null);}}; window.addEventListener("keydown",close); return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close);}; },[rcReview,customerCandidates,ownershipConflict]);

  const numeric=(value:string)=>Number(value||0);
  const calculations=useMemo(()=>{ const od=numeric(form.od),tp=numeric(form.tp),cpa=form.cpaOpted==="Yes"?numeric(form.cpa):0; const net=od+tp+cpa,gst=form.vehicleClass==="GCV"?((od+cpa)*.18)+(tp*.05):net*.18,gross=net+gst; const projectedOd=od*numeric(form.projectedOdPercent)/100,projectedTp=tp*numeric(form.projectedTpPercent)/100; const totalPayin=projectedOd+projectedTp+numeric(form.insurerScheme),tds=totalPayin*.10,payinAfterTds=totalPayin-tds; const payoutOd=od*numeric(form.payoutOdPercent)/100,payoutTp=form.payoutBasis==="OD"?0:tp*numeric(form.payoutTpPercent)/100; const grossPayout=Math.max(0,payoutOd+payoutTp),indicativeMargin=payinAfterTds-grossPayout; return{net,gst,gross,projectedOd,projectedTp,totalPayin,tds,payinAfterTds,payoutOd,payoutTp,grossPayout,indicativeMargin}; },[form]);
  function update<K extends keyof FormState>(key:K,value:FormState[K]){setForm(current=>({...current,[key]:value}));}
  function changeVehicleClass(value:string){if(isEdit)return;setForm(current=>({...current,vehicleClass:value,capacity:"",policyProduct:""}));}

  const availableSources=useMemo(()=>sources.filter(item=>item.type===form.intermediaryType),[sources,form.intermediaryType]);
  const rmLabels=useMemo(()=>new Map(rms.map(item=>[item.value,item.label])),[rms]);
  function changeIntermediaryType(value:string){ setForm(current=>({...current,intermediaryType:value,leadSource:"",intermediaryCode:"",rmName:""})); }
  function changeLeadSource(value:string){ const selected=sources.find(item=>item.type===form.intermediaryType&&item.label.trim().toLowerCase()===value.trim().toLowerCase()); setForm(current=>({...current,leadSource:value,intermediaryCode:selected?.code??"",rmName:selected?.rmName??""})); }

  function fetchRcDetails(){ if(isEdit)return; setLookupError(null);setRcReview(null);startLookup(async()=>{const result=await lookupPolicyRegistrationRc(form.registrationNo);if(!result.ok){setLookupError(result.error);return;}setApplyGroups(defaultGroups);setRcReview(result.review);}); }
  function useRcDetails(){ if(!rcReview||isEdit)return; const mappedClass=classifyVehicle(rcReview.vehicleClass); setForm(current=>({...current,registrationNo:rcReview.registrationNumber||current.registrationNo,insuredName:applyGroups.ownerIdentity?(current.insuredName||rcReview.ownerName||""):current.insuredName,phoneNo:applyGroups.ownerIdentity?(current.phoneNo||(rcReview.mobileNumber??"").replace(/\D/g,"").slice(-10)):current.phoneNo,vehicleClass:applyGroups.vehicleIdentity?(current.vehicleClass||mappedClass):current.vehicleClass,make:applyGroups.vehicleIdentity?(current.make||rcReview.make||""):current.make,model:applyGroups.vehicleIdentity?(current.model||rcReview.model||""):current.model,fuelType:applyGroups.vehicleIdentity?(current.fuelType||normalizeFuel(rcReview.fuelType)):current.fuelType,capacity:applyGroups.technical?(current.capacity||capacityFor(rcReview,current.vehicleClass||mappedClass)):current.capacity,manufacturingYear:applyGroups.vehicleIdentity?(current.manufacturingYear||rcReview.manufacturingYear||""):current.manufacturingYear,chassisNo:applyGroups.technical?(current.chassisNo||rcReview.chassisNumber||""):current.chassisNo,engineNo:applyGroups.technical?(current.engineNo||rcReview.engineNumber||""):current.engineNo,rtoState:applyGroups.compliance?(current.rtoState||titleCase(rcReview.rtoState)):current.rtoState,rtoName:applyGroups.compliance?(current.rtoName||rcReview.rtoName||""):current.rtoName})); setAppliedRc(rcReview);setRcReview(null); }

  function buildCreatePayload():PolicyOnboardingPayload{ const rc=appliedRc; return{customer:{name:form.insuredName,phone:form.phoneNo,type:"individual",source:form.leadSource||"policy_onboarding",address:applyGroups.ownerAddress?(rc?.presentAddress||rc?.permanentAddress||""):"",city:applyGroups.ownerAddress?(rc?.ownerCity||""):"",district:applyGroups.ownerAddress?(rc?.ownerDistrict||""):"",state:applyGroups.ownerAddress?(rc?.ownerState||form.rtoState):"",pincode:applyGroups.ownerAddress?(rc?.ownerPincode||""):"",country:"India"},vehicle:{registrationNumber:form.registrationNo,classCode:form.vehicleClass,classDescription:vehicleClassMap[form.vehicleClass]?.description||rc?.vehicleClass||"",category:rc?.vehicleCategory||"",bodyType:rc?.bodyType||"",isCommercial:rc?boolValue(rc.isCommercial):null,make:form.make,model:form.model,fuelType:form.fuelType,color:rc?.color||"",manufactureDate:rc?.manufactureDate||"",manufacturingYear:form.manufacturingYear,capacity:form.capacity,engineCapacity:rc?.engineCapacity||(form.vehicleClass==="PCP"||form.vehicleClass==="TWP"?form.capacity:""),seatingCapacity:rc?.seatingCapacity||(form.vehicleClass==="PCV"?form.capacity:""),standingCapacity:rc?.standingCapacity||"",sleeperCapacity:rc?.sleeperCapacity||"",grossWeight:rc?.grossWeight||(form.vehicleClass==="GCV"||form.vehicleClass==="CPM"?form.capacity:""),unladenWeight:rc?.unladenWeight||"",wheelBase:rc?.wheelBase||"",cylinders:rc?.cylinders||"",chassisNumber:form.chassisNo,engineNumber:form.engineNo,normsType:rc?.normsType||"",registrationDate:isoDate(rc?.registrationDate||null),registrationStatus:rc?.registrationStatus||"",statusAsOn:isoDate(rc?.statusAsOn||null),rtoName:form.rtoName,rtoState:form.rtoState,fitnessExpiryDate:isoDate(rc?.fitnessExpiryDate||null),taxUpto:isoDate(rc?.taxUpto||null),pucNumber:rc?.pucNumber||"",pucUpto:isoDate(rc?.pucUpto||null),permitNumber:rc?.permitNumber||"",permitType:rc?.permitType||"",permitValidFrom:isoDate(rc?.permitValidFrom||null),permitValidUpto:isoDate(rc?.permitValidUpto||null),nationalPermitNumber:rc?.nationalPermitNumber||"",nationalPermitUpto:isoDate(rc?.nationalPermitUpto||null),financed:rc?boolValue(rc.financed):null,financerName:rc?.financerName||"",blacklistStatus:rc?.blacklistStatus||""},policy:{issuanceDate:form.issuanceDate,rmName:form.rmName,intermediaryType:form.intermediaryType,leadSource:form.leadSource,intermediaryCode:form.intermediaryCode,businessLine:form.businessLine,policyType:form.policyProduct,idv:form.idv,policyNumber:form.policyNo,insuranceCompanyId:form.insurerId,validFrom:form.validFrom,validUpto:form.validUpto,remarks:form.remarks},premium:{od:form.od,tp:form.tp,cpaOpted:form.cpaOpted==="Yes",cpa:form.cpa},payin:{basis:form.payoutBasis,odPercent:form.projectedOdPercent,tpPercent:form.projectedTpPercent,scheme:form.insurerScheme},billing:{billNumber:form.payinBillNo,billedAmount:form.payinBilledAmount,billDate:form.payinBillDate,status:form.payinStatus},payout:{retention:String(calculations.indicativeMargin),odPercent:form.payoutOdPercent,tpPercent:form.payoutTpPercent,status:form.payoutStatus,date:form.payoutDate,voucherNumber:form.payoutVoucherNo},authbridge:{applied:Boolean(rc),transactionId:rc?.transactionId||"",providerTransactionId:rc?.providerTransactionId||"",lookedUpAt:rc?.lookedUpAt||""}}; }
  function buildEditPayload():PolicyEditPayload{return{policy:{issuanceDate:form.issuanceDate,rmName:form.rmName,intermediaryType:form.intermediaryType,leadSource:form.leadSource,intermediaryCode:form.intermediaryCode,businessLine:form.businessLine,policyType:form.policyProduct,idv:form.idv,policyNumber:form.policyNo,insuranceCompanyId:form.insurerId,validFrom:form.validFrom,validUpto:form.validUpto,remarks:form.remarks},premium:{od:form.od,tp:form.tp,cpaOpted:form.cpaOpted==="Yes",cpa:form.cpaOpted==="Yes"?form.cpa:"0"},payin:{basis:form.payoutBasis,odPercent:form.projectedOdPercent,tpPercent:form.projectedTpPercent,scheme:form.insurerScheme},billing:{billNumber:form.payinBillNo,billedAmount:form.payinBilledAmount,billDate:form.payinBillDate,status:form.payinStatus},payout:{retention:String(calculations.indicativeMargin),odPercent:form.payoutOdPercent,tpPercent:form.payoutTpPercent,status:form.payoutStatus,date:form.payoutDate,voucherNumber:form.payoutVoucherNo}};}

  function runCreate(payload:PolicyOnboardingPayload){setSubmitError(null);startSubmit(async()=>{const result=await onboardPolicy(payload);if(result.ok){router.push(`/policies?success=policy_created&policy=${encodeURIComponent(result.policyCode)}`);return;}if(result.kind==="customer_match"){setPendingPayload(payload);setCustomerCandidates(result.candidates);return;}if(result.kind==="ownership_conflict"){setPendingPayload(payload);setOwnershipConflict(result.conflict);return;}setSubmitError(result.error);});}
  function submitPolicy(){ if(isEdit){const policyId=initialValues?.policyId;if(!policyId){setSubmitError("Policy reference is missing.");return;}setSubmitError(null);startSubmit(async()=>{const result=await updatePolicyOnboarding(policyId,buildEditPayload());if(!result.ok){setSubmitError(result.error);return;}const policyRef=result.policyCode||initialValues?.policyCode||form.policyNo;router.push(`/policies?success=policy_updated&policy=${encodeURIComponent(policyRef||"")}`);router.refresh();});return;}runCreate(buildCreatePayload()); }
  function chooseCustomer(id:string|null){if(!pendingPayload)return;setCustomerCandidates(null);runCreate({...pendingPayload,resolution:{...pendingPayload.resolution,selectedCustomerId:id,createNewCustomer:!id}});}
  function resolveOwnership(decision:"keep_existing"|"transfer"){if(!pendingPayload||!ownershipConflict)return;setOwnershipConflict(null);runCreate({...pendingPayload,resolution:{...pendingPayload.resolution,selectedCustomerId:decision==="keep_existing"?ownershipConflict.customerId:pendingPayload.resolution?.selectedCustomerId,createNewCustomer:decision==="transfer"?pendingPayload.resolution?.createNewCustomer:false,ownershipDecision:decision,transferReason:"Confirmed during policy onboarding"}});}

  const vehicleMeta=vehicleClassMap[form.vehicleClass];
  const policyProducts=form.vehicleClass==="PCP"||form.vehicleClass==="TWP"?["Package","Third Party","SAOD","Bundled","Long Term Package","Long Term Third Party"]:["Package","Third Party","SAOD"];
  const policyTypeOptions=["Motor","Health","Life","Travel","Personal Accident","Fire","Marine","Engineering","Liability","Cyber","Property","Agriculture / Crop","Other / Miscellaneous"];
  const isMotorPolicy=form.businessLine==="Motor";
  const headerTitle=isEdit?"Edit Policy":"Policy Onboarding";
  const submitText=isEdit?"Save Policy Changes":"Book Active Policy";
  const pendingText=isEdit?"Saving changes…":"Booking policy…";

  return <div className="mx-auto max-w-[1480px] pb-24">
    <datalist id="policy-lead-source-master-options">{availableSources.map(item=><option key={item.value} value={item.label}>{[item.code,item.rmName].filter(Boolean).join(" · ")}</option>)}</datalist>
    <div className="overflow-hidden rounded-t-2xl border border-b-0 border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.06)]">
      <div className="flex min-h-[88px] items-center bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 py-3.5 text-white">
        <div><h1 className="text-[18px] font-semibold">{headerTitle}</h1></div>
      </div>
    </div>
    <div className={`${isMotorPolicy?"sticky top-[72px] z-50 mb-4 flex":"hidden"} gap-1 overflow-x-auto rounded-b-2xl border border-t-0 border-[#D9E2F0] bg-white/95 px-3 py-2 shadow-[0_7px_18px_rgba(15,23,42,.08)] backdrop-blur`}>{sections.map((section,index)=>{const progress=sectionProgress[index];return <button key={section} type="button" onClick={()=>goToSection(index)} title={progress.complete?`${section} complete`:`${progress.remaining} required item${progress.remaining===1?"":"s"} remaining`} className={`group flex min-w-fit items-center gap-2 rounded-lg px-3 py-2 text-[9.5px] font-semibold transition ${activeSection===index?"bg-[#EEF2FF] text-[#4338CA]":"text-[#667085] hover:bg-[#F8FAFC]"}`}><span className={`grid h-5 w-5 place-items-center rounded-full text-[8px] font-bold ${progress.complete?"bg-[#E8F7EF] text-[#14845B]":progress.empty?(activeSection===index?"bg-[#4F46E5] text-white":"bg-[#EEF2F6] text-[#7A8798]"):"bg-[#FFF4D8] text-[#B76E00]"}`}>{progress.complete?<svg aria-hidden="true" viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 10 3 3 7-7"/></svg>:index+1}</span><span>{section}</span>{!progress.complete&&!progress.empty?<span className="text-[7.5px] font-semibold text-[#B76E00]">{progress.remaining} left</span>:null}</button>})}</div>

    <div className={`grid gap-4 ${isMotorPolicy?"xl:grid-cols-[minmax(0,1fr)_300px]":""}`}><div className={`space-y-4 ${isMotorPolicy?"":"[&>#policy-section-2]:hidden [&>#policy-section-3]:hidden [&>#policy-section-4]:hidden [&>#policy-section-5]:hidden"}`}>
      <Section number="01" title="Policy source & ownership">
        <div><Field label="Policy issuance date" type="date" value={form.issuanceDate} onChange={e=>update("issuanceDate",e.target.value)} required/><CompactSourceMeta label="Month" value={form.issuanceDate?new Date(`${form.issuanceDate}T00:00:00`).toLocaleDateString("en-US",{month:"short",year:"2-digit"}):"—"}/></div>
        <div><Select label="Policy type" value={form.businessLine} onChange={e=>update("businessLine",e.target.value)} options={policyTypeOptions} placeholder="Select policy type" required/></div>
        <div><Select label="Intermediary type" value={form.intermediaryType} onChange={e=>changeIntermediaryType(e.target.value)} options={["POSP","MISP","SIBL / Partner"]} placeholder="Select type" required/><CompactSourceMeta label="RM" value={form.rmName||"Select lead source"}/><input type="hidden" aria-label="RM name" value={form.rmName} readOnly/></div>
        <div><Field label="Lead source" list="policy-lead-source-master-options" autoComplete="off" value={form.leadSource} onChange={e=>changeLeadSource(e.target.value)} placeholder={form.intermediaryType?"Start typing a name":"Select intermediary type first"} disabled={!form.intermediaryType} required/><CompactSourceMeta label="ID" value={form.intermediaryCode||"Select lead source"}/><input type="hidden" aria-label="Intermediary code" value={form.intermediaryCode} readOnly/></div>
      </Section>

      <Section number="02" title="Insured & vehicle identification" subtitle={isEdit?"Linked customer and vehicle details are protected from policy-level edits.":undefined}>
        <div>
          <label className={labelClass}>Registration No. <Required/><RcStatusIcon state={lookupError?"error":isLookingUp?"checking":appliedRc||isEdit?"verified":"idle"}/></label>
          <div className="flex">
            <input className={`${inputClass} min-w-0 rounded-r-none border-r-0 uppercase focus:z-10`} value={form.registrationNo} onChange={e=>{if(!isEdit){update("registrationNo",e.target.value.toUpperCase());setAppliedRc(null);setLookupError(null);}}} readOnly={isEdit} disabled={isEdit} placeholder="MP20AB1234"/>
            {!isEdit?<button type="button" onClick={fetchRcDetails} disabled={isLookingUp||form.registrationNo.replace(/[^A-Z0-9]/gi,"").length<6} aria-label={isLookingUp?"Fetching RC details":"Fetch RC details"} title={isLookingUp?"Fetching RC details":"Fetch RC details"} className="group grid h-10 w-11 shrink-0 place-items-center rounded-l-none rounded-r-xl border border-[#17365D] bg-[#17365D] text-white transition hover:bg-[#214A7A] focus:outline-none focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:border-[#A8B4C3] disabled:bg-[#A8B4C3] disabled:opacity-70">{isLookingUp?<RcFetchSpinner/>:<RcFetchIcon/>}</button>:null}
          </div>
          {lookupError?<p className="mt-1 text-[8.5px] font-semibold text-red-600">{lookupError}</p>:null}
        </div>
        <Field label="Insured name" value={form.insuredName} onChange={e=>update("insuredName",e.target.value.toUpperCase())} placeholder="Customer / insured name" required disabled={isEdit}/>
        <Field label="Phone number" value={form.phoneNo} onChange={e=>update("phoneNo",e.target.value.replace(/\D/g,"").slice(0,10))} placeholder="Mandatory 10 digit mobile" inputMode="numeric" required disabled={isEdit}/>
        <div>
          <label className={labelClass}>Class <Required/>{vehicleMeta?<span className="ml-1 truncate text-[8.5px] font-semibold normal-case tracking-normal text-[#315B6B]">{vehicleMeta.description}</span>:null}</label>
          <select className={inputClass} value={form.vehicleClass} onChange={e=>changeVehicleClass(e.target.value)} required disabled={isEdit}><option value="">Select class</option>{Object.keys(vehicleClassMap).map(option=><option key={option} value={option}>{option}</option>)}</select>
        </div>

        <Field label="Make" value={form.make} onChange={e=>update("make",e.target.value)} placeholder="Manufacturer" disabled={isEdit}/>
        <Field label="Model" value={form.model} onChange={e=>update("model",e.target.value)} placeholder="Model / variant" disabled={isEdit}/>
        <Select label="Fuel type" value={form.fuelType} onChange={e=>update("fuelType",e.target.value)} options={["Petrol","Diesel","CNG","Electric","Hybrid","Bi-Fuel","Other"]} placeholder="Select fuel" disabled={isEdit}/>
        <Select label="Year of manufacturing" value={form.manufacturingYear} onChange={e=>update("manufacturingYear",e.target.value)} options={Array.from({length:40},(_,i)=>String(new Date().getFullYear()-i))} placeholder="Select year" disabled={isEdit}/>

        <div><label className={labelClass}>RTO</label><div className="grid grid-cols-[.9fr_1.1fr] gap-2"><input className={inputClass} value={form.rtoState} onChange={e=>update("rtoState",e.target.value)} placeholder="State" disabled={isEdit}/><input className={inputClass} value={form.rtoName} onChange={e=>update("rtoName",e.target.value)} placeholder="Name / code" disabled={isEdit}/></div></div>
        <Field label={vehicleMeta?`Capacity (${vehicleMeta.capacityLabel})`:"Capacity"} value={form.capacity} onChange={e=>update("capacity",e.target.value)} placeholder={vehicleMeta?`Enter ${vehicleMeta.capacityLabel.toLowerCase()}`:"Select class first"} disabled={isEdit||!form.vehicleClass}/>
        <Field label="Chassis number" value={form.chassisNo} onChange={e=>update("chassisNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
        <Field label="Engine number" value={form.engineNo} onChange={e=>update("engineNo",e.target.value.toUpperCase())} placeholder="Fetched from RC or enter manually" disabled={isEdit}/>
      </Section>

      <Section number="03" title="Policy product, premium & validity" action={<PolicyOcrImportPanel variant="icon"/>}>
        <Select label="Policy product" value={form.policyProduct} onChange={e=>update("policyProduct",e.target.value)} options={policyProducts} placeholder="Select product" disabled={!form.vehicleClass} required/>
        <Field label="Policy number" value={form.policyNo} onChange={e=>update("policyNo",e.target.value.toUpperCase())} placeholder="Policy number" required/>
        <div><label className={labelClass}>Insurance company <Required/></label><select className={inputClass} value={form.insurerId} onChange={e=>update("insurerId",e.target.value)} required><option value="">Select insurer</option>{insurers.map(i=><option key={i.value} value={i.value}>{i.label}</option>)}</select></div>
        <Field label="IDV" type="number" min="0" value={form.idv} onChange={e=>update("idv",e.target.value)} placeholder="₹ 0.00" required/>

        <Field label="OD premium" type="number" min="0" value={form.od} onChange={e=>update("od",e.target.value)} placeholder="₹ 0.00" required/>
        <Field label="TP premium" type="number" min="0" value={form.tp} onChange={e=>update("tp",e.target.value)} placeholder="₹ 0.00" required/>
        <Field label="CPA amount" type="number" min="0" value={form.cpa} onChange={e=>{const value=e.target.value;setForm(current=>({...current,cpa:value,cpaOpted:Number(value||0)>0?"Yes":"No"}));}} placeholder="₹ 0.00"/>
        <PolicyValidityField validFrom={form.validFrom} validUpto={form.validUpto} onFromChange={value=>update("validFrom",value)} onUptoChange={value=>update("validUpto",value)}/>
      </Section>

      <Section number="04" title="Projected insurer pay-in">
        <div>
          <PercentField label="OD Pay-in %" value={form.projectedOdPercent} onChange={v=>update("projectedOdPercent",v)}/>
          <CalculatedSubline value={money.format(calculations.projectedOd)}/>
        </div>
        <div>
          <PercentField label="TP Pay-in %" value={form.projectedTpPercent} onChange={v=>update("projectedTpPercent",v)}/>
          <CalculatedSubline value={money.format(calculations.projectedTp)}/>
        </div>
        <Field label="Insurer scheme" type="number" min="0" value={form.insurerScheme} onChange={e=>update("insurerScheme",e.target.value)} placeholder="₹ 0.00"/>
        <CalculatedField label="Retention" value={money.format(calculations.indicativeMargin)} tone={calculations.indicativeMargin<0?"negative":calculations.indicativeMargin>0?"positive":"neutral"}/>
        <PolicyPayinBillingFields
          billNumber={form.payinBillNo}
          billedAmount={form.payinBilledAmount}
          billDate={form.payinBillDate}
          status={form.payinStatus}
          calculatedAmount={calculations.totalPayin}
          onBillNumberChange={value=>update("payinBillNo",value)}
          onBilledAmountChange={value=>update("payinBilledAmount",value)}
          onBillDateChange={value=>update("payinBillDate",value)}
          onStatusChange={value=>update("payinStatus",value)}
        />
        <div className="md:col-span-2 xl:col-span-4"><PayinOutcomeLine total={calculations.totalPayin} tds={calculations.tds} net={calculations.payinAfterTds}/></div>
      </Section>

      <Section number="05" title="Intermediary payout & settlement">
        <div>
          <PercentField label="Payout OD %" value={form.payoutOdPercent} onChange={v=>update("payoutOdPercent",v)}/>
          <CalculatedSubline value={money.format(calculations.payoutOd)}/>
        </div>
        <div>
          <PercentField label="Payout TP %" value={form.payoutTpPercent} onChange={v=>update("payoutTpPercent",v)} disabled={form.payoutBasis==="OD"}/>
          <CalculatedSubline value={money.format(calculations.payoutTp)}/>
        </div>
        <Select label="Payout status" value={form.payoutStatus} onChange={e=>update("payoutStatus",e.target.value)} options={["Pending","Approved","On Hold","Processed","Paid","Cancelled"]} placeholder="Select status"/>
        <SettlementField date={form.payoutDate} voucher={form.payoutVoucherNo} onDateChange={value=>update("payoutDate",value)} onVoucherChange={value=>update("payoutVoucherNo",value.toUpperCase())}/>
        <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E4EAF1] pt-2">
          <button type="button" onClick={()=>setRemarksOpen(open=>!open)} className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-[#526277] transition hover:text-[#17365D]" aria-expanded={remarksOpen}><span className="text-[13px] font-light leading-none">{remarksOpen?"−":"+"}</span>{remarksOpen?"Hide remarks":"Add remarks"}</button>
          <PayoutOutcomeLine od={calculations.payoutOd} tp={calculations.payoutTp} total={calculations.grossPayout}/>
        </div>
        {remarksOpen?<div className="md:col-span-2 xl:col-span-4"><label className={labelClass}>Remarks</label><textarea className="min-h-16 w-full rounded-xl border border-[#D8DEE9] px-3 py-2 text-[11px] outline-none focus:border-[#315B9A]" value={form.remarks} onChange={e=>update("remarks",e.target.value)} placeholder="Add policy, billing or payout notes"/></div>:null}
      </Section>
      {!isMotorPolicy?<PolicyTypeDevelopmentNotice policyType={form.businessLine}/>:null}
    </div>{isMotorPolicy?<LiveSummary completion={Math.round(sectionProgress.reduce((sum,item)=>sum+item.filled,0)/sectionProgress.reduce((sum,item)=>sum+item.total,0)*100)} net={calculations.net} gst={calculations.gst} gross={calculations.gross} projectedOd={calculations.projectedOd} projectedTp={calculations.projectedTp} scheme={numeric(form.insurerScheme)} totalPayin={calculations.totalPayin} tds={calculations.tds} payinAfterTds={calculations.payinAfterTds} retention={calculations.indicativeMargin} grossPayout={calculations.grossPayout}/>:null}</div>

    <div className={isMotorPolicy?"fixed bottom-0 left-0 right-0 z-40 border-t border-[#D9E2F0] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,.08)] backdrop-blur":"hidden"}><div className="mx-auto flex max-w-[1480px] justify-end gap-2"><Link href="/policies" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold">Cancel</Link><button type="button" onClick={submitPolicy} disabled={isSubmitting} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white disabled:opacity-60">{isSubmitting?pendingText:submitText}</button></div></div>
    {submitError?<ValidationErrorDialog message={submitError} onClose={()=>setSubmitError(null)}/>:null}
    {!isEdit&&rcReview?<RcModal review={rcReview} groups={applyGroups} setGroups={setApplyGroups} onCancel={()=>setRcReview(null)} onUse={useRcDetails}/>:null}
    {!isEdit&&customerCandidates?<CustomerMatchModal candidates={customerCandidates} onChoose={chooseCustomer} onCancel={()=>setCustomerCandidates(null)}/>:null}
    {!isEdit&&ownershipConflict?<OwnershipModal conflict={ownershipConflict} onResolve={resolveOwnership} onCancel={()=>setOwnershipConflict(null)}/>:null}
  </div>;
}

function PolicyTypeDevelopmentNotice({policyType}:{policyType:string}){return <section className="flex min-h-[240px] items-center justify-center rounded-2xl border border-[#D9E2F0] bg-white px-6 py-10 text-center shadow-sm"><div className="max-w-md"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#EEF3FA] text-[#315B9A]"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/></svg></div><h2 className="mt-4 text-[15px] font-semibold text-[#17365D]">{policyType} onboarding</h2><p className="mt-2 text-[11px] leading-5 text-[#667085]">Onboarding page for this Policy type is still in development.</p><p className="mt-1 text-[9px] text-[#98A2B3]">Select Motor in Policy type above to use the active onboarding workflow.</p></div></section>;}
function Section({number,title,subtitle,badge,action,children}:{number:string;title:string;subtitle?:string;badge?:string;action?:ReactNode;children:ReactNode}){const index=Math.max(0,Number(number)-1);return <section id={`policy-section-${index+1}`} data-section-index={index} className="scroll-mt-[148px] overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex min-h-12 items-center justify-between border-b bg-[#FBFCFE] px-4 py-2.5"><div className="flex items-center gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#17365D] text-[9px] font-bold text-white">{number}</span><div className="flex min-h-8 flex-col justify-center"><h2 className="text-[13px] font-semibold leading-tight">{title}</h2>{subtitle?<p className="mt-0.5 text-[9px] leading-tight text-[#667085]">{subtitle}</p>:null}</div></div><div className="flex items-center gap-2">{badge?<span className="rounded-full border bg-white px-2.5 py-1 text-[8px] text-[#667085]">{badge}</span>:null}{action}</div></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>;}
function PolicyValidityField({validFrom,validUpto,onFromChange,onUptoChange}:{validFrom:string;validUpto:string;onFromChange:(value:string)=>void;onUptoChange:(value:string)=>void}){return <div><label className={labelClass}>Policy validity <Required/></label><div className="grid h-10 grid-cols-2 overflow-hidden rounded-xl border border-[#D8DEE9] bg-white transition hover:border-[#B8C2D1] focus-within:border-[#315B9A] focus-within:ring-2 focus-within:ring-[#DCE8FA]"><label className="relative min-w-0 border-r border-[#E1E6ED]"><span className="pointer-events-none absolute left-3 top-1 text-[7px] font-bold uppercase tracking-[.06em] text-[#7A8798]">From</span><input aria-label="Valid from" type="date" value={validFrom} onChange={e=>onFromChange(e.target.value)} required className="h-full w-full border-0 bg-transparent px-3 pb-0.5 pt-3 text-[9.5px] font-medium text-[#17203A] outline-none"/></label><label className="relative min-w-0"><span className="pointer-events-none absolute left-3 top-1 text-[7px] font-bold uppercase tracking-[.06em] text-[#7A8798]">Upto</span><input aria-label="Valid upto" type="date" value={validUpto} onChange={e=>onUptoChange(e.target.value)} required className="h-full w-full border-0 bg-transparent px-3 pb-0.5 pt-3 text-[9.5px] font-medium text-[#17203A] outline-none"/></label></div></div>;}
function Field({label,required,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string}){return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><input {...props} required={required} className={inputClass}/></div>;}
function Select({label,options,placeholder,required,...props}:SelectHTMLAttributes<HTMLSelectElement>&{label:string;options:string[];placeholder:string}){const unique=Array.from(new Set(options.filter(Boolean)));return <div><label className={labelClass}>{label}{required?<Required/>:null}</label><select {...props} required={required} className={inputClass}><option value="">{placeholder}</option>{unique.map(o=><option key={o} value={o}>{o}</option>)}</select></div>;}
function CalculatedSubline({value}:{value:string}){return <div className="mt-1.5 px-0.5 text-[9px] text-[#7A8798]">Calculated Amt. : <span className="font-semibold text-[#315B6B]">{value}</span></div>;}
function CalculatedField({label,value,tone="neutral"}:{label:string;value:string;tone?:"positive"|"negative"|"neutral"}){const toneClass=tone==="positive"?"text-[#14845B]":tone==="negative"?"text-[#C63E45]":"text-[#17365D]";return <div><label className={labelClass}>{label}</label><div className="flex h-10 items-center rounded-xl border border-[#E1E7EF] bg-[#F8FAFC] px-3"><span className={`text-[11px] font-bold ${toneClass}`}>{value}</span><span className="ml-auto text-[7.5px] font-semibold uppercase tracking-[.05em] text-[#98A2B3]">Auto</span></div></div>;}
function PayinOutcomeLine({total,tds,net}:{total:number;tds:number;net:number}){return <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-[#E4EAF1] pt-2 text-[9px]"><span className="font-bold uppercase tracking-[.06em] text-[#667085]">Pay-in outcome</span><span className="text-[#98A2B3]">Total <strong className="font-semibold text-[#17365D]">{money.format(total)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#98A2B3]">TDS <strong className="font-semibold text-[#17365D]">{money.format(tds)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#667085]">Net <strong className="font-bold text-[#315B9A]">{money.format(net)}</strong></span></div>;}
function SettlementField({date,voucher,onDateChange,onVoucherChange}:{date:string;voucher:string;onDateChange:(value:string)=>void;onVoucherChange:(value:string)=>void}){return <div><label className={labelClass}>Settlement</label><div className="grid h-10 grid-cols-[.88fr_1.12fr] overflow-hidden rounded-xl border border-[#D8DEE9] bg-white transition hover:border-[#B8C2D1] focus-within:border-[#315B9A] focus-within:ring-2 focus-within:ring-[#DCE8FA]"><label className="relative min-w-0 border-r border-[#E1E6ED]"><span className="pointer-events-none absolute left-3 top-1 text-[7px] font-bold uppercase tracking-[.06em] text-[#7A8798]">Date</span><input aria-label="Payout date" type="date" value={date} onChange={e=>onDateChange(e.target.value)} className="h-full w-full border-0 bg-transparent px-3 pb-0.5 pt-3 text-[9.5px] font-medium text-[#17203A] outline-none"/></label><label className="relative min-w-0"><span className="pointer-events-none absolute left-3 top-1 text-[7px] font-bold uppercase tracking-[.06em] text-[#7A8798]">Voucher</span><input aria-label="Payout voucher number" value={voucher} onChange={e=>onVoucherChange(e.target.value)} placeholder="Reference" className="h-full w-full border-0 bg-transparent px-3 pb-0.5 pt-3 text-[9.5px] font-medium text-[#17203A] outline-none placeholder:text-[#B0BAC8]"/></label></div></div>;}
function PayoutOutcomeLine({od,tp,total}:{od:number;tp:number;total:number}){return <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[9px]"><span className="font-bold uppercase tracking-[.06em] text-[#667085]">Payout outcome</span><span className="text-[#98A2B3]">OD <strong className="font-semibold text-[#17365D]">{money.format(od)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#98A2B3]">TP <strong className="font-semibold text-[#17365D]">{money.format(tp)}</strong></span><span className="text-[#CBD2DC]">|</span><span className="text-[#667085]">Total <strong className="font-bold text-[#315B9A]">{money.format(total)}</strong></span></div>;}
function PercentField({label,value,onChange,disabled}:{label:string;value:string;onChange:(v:string)=>void;disabled?:boolean}){return <Field label={label} type="number" min="0" max="100" step="0.01" value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} placeholder="0.00"/>;}
function Required(){return <span className="text-red-500">*</span>;}
function RcFetchIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><circle cx="13" cy="12" r="4"/><path d="m16 15 3 3"/></svg>;}
function RcFetchSpinner(){return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[17px] w-[17px] animate-spin" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>;}
function RcStatusIcon({state}:{state:"idle"|"checking"|"verified"|"error"}){const config={idle:{title:"RC not checked",className:"text-[#98A2B3]",node:<circle cx="12" cy="12" r="6"/>},checking:{title:"Checking RC",className:"animate-spin text-[#3B82F6]",node:<path d="M20 12a8 8 0 1 1-5.5-7.61"/>},verified:{title:"RC verified",className:"text-[#16A36A]",node:<><circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2 4.8-5"/></>},error:{title:"RC verification error",className:"text-[#DC3545]",node:<><circle cx="12" cy="12" r="8"/><path d="M12 8v5"/><path d="M12 16h.01"/></>}}[state];return <span className="inline-flex items-center" title={config.title} aria-label={config.title}><svg aria-hidden="true" viewBox="0 0 24 24" className={`h-3.5 w-3.5 ${config.className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{config.node}</svg></span>;}
function DerivedDisplay({label,value,source}:{label:string;value:string;source?:string}){return <div className="min-w-0 border-l-2 border-[#D9E4F2] py-1 pl-3"><div className="flex items-center gap-2"><span className="text-[8px] font-bold uppercase tracking-[.08em] text-[#667085]">{label}</span>{source?<span className="rounded-full bg-[#EDF7F2] px-1.5 py-0.5 text-[7px] font-bold text-[#18794E]">{source}</span>:null}</div><div className="mt-1 truncate text-[11px] font-semibold text-[#17365D]">{value||"—"}</div></div>;}
function CompactSourceMeta({label,value,source}:{label:string;value:string;source?:string}){const sourceTone=source==="Auto"?"text-[#16825D]":source==="Assigned"?"text-[#3B6EA8]":source==="Master"?"text-[#7657A6]":"text-[#718096]";const hasValue=Boolean(value&&value!=="Select lead source");return <div className="mt-1.5 min-h-[18px] px-0.5"><div className="flex min-w-0 items-center gap-1.5 leading-[1.15]"><span className="shrink-0 text-[8.5px] font-semibold tracking-[.015em] text-[#718096]">{label}</span>{source?<span className={`shrink-0 text-[7.5px] font-bold uppercase tracking-[.07em] ${sourceTone}`}>{source}</span>:null}<span className="shrink-0 text-[8.5px] font-semibold text-[#C1CAD6]">·</span><span className={`min-w-0 truncate text-[10px] font-semibold tracking-[.005em] ${hasValue?"text-[#244C73]":"text-[#98A2B3]"}`}>{value}</span></div></div>;}
function PremiumCalculationBand({net,gst,gross,gstRule}:{net:number;gst:number;gross:number;gstRule:string}){return <div className="md:col-span-2 xl:col-span-4 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[linear-gradient(90deg,#F8FBFF,#F4F8FD)]"><div className="grid grid-cols-3 divide-x divide-[#DFE7F1]"><CalculationMetric label="Net premium" value={money.format(net)}/><CalculationMetric label="GST" value={money.format(gst)} note={gstRule}/><CalculationMetric label="Gross premium" value={money.format(gross)} accent/></div></div>;}
function PayinCalculationBand({total,tds,afterTds}:{total:number;tds:number;afterTds:number}){return <div className="md:col-span-2 xl:col-span-4 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[#F8FAFD]"><div className="grid grid-cols-3 divide-x divide-[#DFE7F1]"><CalculationMetric label="Total projected pay-in" value={money.format(total)}/><CalculationMetric label="TDS" value={money.format(tds)} note="10%"/><CalculationMetric label="Pay-in after TDS" value={money.format(afterTds)} accent/></div></div>;}
function CalculationMetric({label,value,note,accent=false}:{label:string;value:string;note?:string;accent?:boolean}){return <div className={`px-3 py-2.5 ${accent?"bg-[#EEF4FF]":""}`}><div className="flex items-center justify-between gap-2"><span className="text-[7.5px] font-bold uppercase tracking-[.07em] text-[#667085]">{label}</span>{note?<span className="text-[7px] font-semibold text-[#98A2B3]">{note}</span>:null}</div><div className={`mt-1 text-[12px] font-bold ${accent?"text-[#4F46E5]":"text-[#17365D]"}`}>{value}</div></div>;}
function CalculatedOutcome({label,value,accent=false}:{label:string;value:string;accent?:boolean}){return <div className="flex min-h-10 items-center justify-between gap-3 border-b border-dashed border-[#D9E2F0] px-1 py-1"><div><div className="text-[7.5px] font-bold uppercase tracking-[.07em] text-[#667085]">{label}</div><div className="mt-0.5 text-[7px] font-medium text-[#98A2B3]">Calculated</div></div><div className={`text-[11px] font-bold ${accent?"text-[#4F46E5]":"text-[#17365D]"}`}>{value}</div></div>;}
function CompletionRing({value}:{value:number}){const clamped=Math.max(0,Math.min(100,value));const radius=19,circumference=2*Math.PI*radius,offset=circumference-(clamped/100)*circumference;return <div className="relative h-12 w-12 shrink-0" aria-label={`${clamped}% complete`} title={`${clamped}% complete`}><svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90"><circle cx="24" cy="24" r={radius} fill="none" stroke="#E3EAF2" strokeWidth="5"/><circle cx="24" cy="24" r={radius} fill="none" stroke="url(#policyCompletionGradient)" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}/><defs><linearGradient id="policyCompletionGradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse"><stop stopColor="#315B9A"/><stop offset="1" stopColor="#19B5A5"/></linearGradient></defs></svg><span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-[#17365D]">{clamped}%</span></div>;}
function LiveSummary({completion,net,gst,gross,projectedOd,projectedTp,scheme,totalPayin,tds,payinAfterTds,retention,grossPayout}:{completion:number;net:number;gst:number;gross:number;projectedOd:number;projectedTp:number;scheme:number;totalPayin:number;tds:number;payinAfterTds:number;retention:number;grossPayout:number}){const anchorRef=useRef<HTMLDivElement>(null);const boundaryRef=useRef<HTMLElement>(null);const[position,setPosition]=useState<{left:number;width:number;top:number}|null>(null);useEffect(()=>{let frame=0;const boundaryElement=boundaryRef.current;if(!boundaryElement){setPosition(null);return;}const updatePosition=()=>{if(window.innerWidth<1280||!anchorRef.current){setPosition(null);return;}const anchorRect=anchorRef.current.getBoundingClientRect();const boundaryRect=boundaryElement.getBoundingClientRect();const fixedCard=document.getElementById("policy-summary-fixed-card");const cardHeight=fixedCard?.getBoundingClientRect().height??0;const preferredTop=Math.max(anchorRect.top,172);const boundaryTop=cardHeight>0?boundaryRect.bottom-cardHeight:preferredTop;setPosition({left:anchorRect.left,width:anchorRect.width,top:Math.min(preferredTop,boundaryTop)});};const scheduleUpdate=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(updatePosition);};updatePosition();frame=requestAnimationFrame(updatePosition);window.addEventListener("resize",scheduleUpdate);window.addEventListener("scroll",scheduleUpdate,true);const observer=new ResizeObserver(scheduleUpdate);observer.observe(boundaryElement);observer.observe(document.documentElement);return()=>{cancelAnimationFrame(frame);window.removeEventListener("resize",scheduleUpdate);window.removeEventListener("scroll",scheduleUpdate,true);observer.disconnect();};},[]);const complete=completion>=100;const card=<div className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-[0_10px_30px_rgba(15,23,42,.10)]"><div className="flex items-center gap-3 border-b bg-[#F8FAFC] px-4 py-3"><div className="min-w-0 flex-1"><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#64748B]">Policy status</p><h3 className="mt-0.5 truncate text-[13px] font-semibold text-[#17365D]">Onboarding summary</h3></div><CompletionRing value={completion}/><span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-bold ${complete?"bg-[#E8F7EF] text-[#14845B]":"bg-[#FFF3CD] text-[#A96A00]"}`}>{complete?"Complete":"In progress"}</span></div><div className="p-4"><p className="mb-2 text-[8px] font-bold uppercase tracking-[.1em] text-[#64748B]">Financial summary</p><div className="divide-y divide-[#E8EDF3]"><SummaryRow label="Net premium" value={money.format(net)}/><SummaryRow label="GST" value={money.format(gst)}/><SummaryRow label="Gross premium" value={money.format(gross)} bold accent/><SummaryRow label="Projected OD pay-in" value={money.format(projectedOd)}/><SummaryRow label="Projected TP pay-in" value={money.format(projectedTp)}/><SummaryRow label="Insurer scheme" value={money.format(scheme)}/><SummaryRow label="Total pay-in" value={money.format(totalPayin)} bold/><SummaryRow label="TDS" value={money.format(tds)}/><SummaryRow label="Pay-in after TDS" value={money.format(payinAfterTds)} bold/><SummaryRow label="Partner payout" value={money.format(grossPayout)} bold/><SummaryRow label="Retention" value={money.format(retention)} tone={retention<0?"negative":retention>0?"positive":"neutral"}/></div></div></div>;return <aside ref={boundaryRef} className="xl:self-stretch"><div className="xl:hidden">{card}</div><div ref={anchorRef} className="hidden h-px w-full xl:block" aria-hidden="true"/>{position&&typeof document!=="undefined"?createPortal(<div id="policy-summary-fixed-card" className="fixed z-30" style={{left:position.left,width:position.width,top:position.top}}>{card}</div>,document.body):null}</aside>;}
function SummaryRow({label,value,bold,accent,tone="neutral"}:{label:string;value:string;bold?:boolean;accent?:boolean;tone?:"positive"|"negative"|"neutral"}){const toneClass=tone==="positive"?"text-[#14845B]":tone==="negative"?"text-[#C63E45]":accent?"text-[#4F46E5]":"text-[#17365D]";return <div className="flex items-center justify-between gap-3 py-2.5"><span className={`text-[10.5px] ${bold?"font-semibold text-[#344054]":"font-medium text-[#667085]"}`}>{label}</span><span className={`text-[11px] ${bold?"font-bold":"font-semibold"} ${toneClass}`}>{value}</span></div>;}
function ValidationErrorDialog({message,onClose}:{message:string;onClose:()=>void}){const okRef=useRef<HTMLButtonElement>(null);useEffect(()=>{const previous=document.body.style.overflow;document.body.style.overflow="hidden";okRef.current?.focus();return()=>{document.body.style.overflow=previous;};},[]);if(typeof document==="undefined")return null;return createPortal(<div className="fixed inset-0 z-[10000] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/60 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true"><div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(7,29,73,.42)]"><div className="px-6 pb-5 pt-7 text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#FFF3E8] text-[24px] text-[#D45B16] ring-8 ring-[#FFF8F2]">!</div><h2 className="mt-5 text-[17px] font-bold text-[#102A4C]">Please check the form</h2><p className="mx-auto mt-2 max-w-sm text-[12px] leading-5 text-[#667085]">{message}</p></div><div className="border-t border-[#E6EBF2] bg-[#F8FAFC] px-6 py-4"><button ref={okRef} type="button" onClick={onClose} className="h-11 w-full rounded-xl bg-[#17365D] px-5 text-[11px] font-bold text-white">OK</button></div></div></div>,document.body);}
function ModalShell({title,subtitle,onClose,children,footer}:{title:string;subtitle:string;onClose:()=>void;children:ReactNode;footer:ReactNode}){if(typeof document==="undefined")return null;return createPortal(<div className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-[#071D49]/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={title}><div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_30px_100px_rgba(7,29,73,.45)]"><div className="flex shrink-0 items-start justify-between border-b border-[#E6EBF2] bg-[linear-gradient(135deg,#F8FAFD,#EEF4FB)] px-4 py-3 sm:px-5 sm:py-4"><div className="min-w-0 pr-3"><p className="truncate text-[15px] font-bold text-[#102A4C]">{title}</p><p className="mt-1 truncate text-[9.5px] text-[#667085]">{subtitle}</p></div><button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D8DEE9] bg-white text-lg text-[#475467]">×</button></div><div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div><div className="shrink-0 border-t border-[#E6EBF2] bg-white px-4 py-3 sm:px-5 sm:py-4">{footer}</div></div></div>,document.body);}
function RcModal({review,groups,setGroups,onCancel,onUse}:{review:PolicyRcReview;groups:ApplyGroups;setGroups:(value:ApplyGroups)=>void;onCancel:()=>void;onUse:()=>void}){const toggles:Array<[keyof ApplyGroups,string,string]>=[["ownerIdentity","Owner identity","Name and available mobile"],["ownerAddress","Owner address","Address and location"],["vehicleIdentity","Vehicle identity","Class, make, model, fuel and year"],["technical","Technical details","Capacity, chassis and engine"],["compliance","Registration & compliance","RTO, fitness, tax, permit and PUC"],["finance","Hypothecation","Financed status and financer"]];return <ModalShell title="AuthBridge RC Verification" subtitle={`${review.registrationNumber} · Review before applying`} onClose={onCancel} footer={<div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-[10px] font-semibold">Cancel</button><button type="button" onClick={onUse} className="rounded-xl bg-emerald-700 px-5 py-2.5 text-[10px] font-bold text-white">Use These Details</button></div>}><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{toggles.map(([key,title,text])=><label key={key} className="flex cursor-pointer gap-3 rounded-xl border p-3"><input type="checkbox" checked={groups[key]} onChange={e=>setGroups({...groups,[key]:e.target.checked})}/><span><span className="block text-[10px] font-bold">{title}</span><span className="text-[8px] text-[#667085]">{text}</span></span></label>)}</div><RcGroup title="Vehicle summary" items={[["Registration",review.registrationNumber],["Owner / insured",review.ownerName],["Vehicle class",review.vehicleClass],["Manufacturer",review.make],["Model",review.model],["Fuel",review.fuelType],["Chassis number",review.chassisNumber],["Engine number",review.engineNumber],["RTO",review.rtoName]]}/></ModalShell>;}
function CustomerMatchModal({candidates,onChoose,onCancel}:{candidates:PolicyCustomerCandidate[];onChoose:(id:string|null)=>void;onCancel:()=>void}){return <ModalShell title="Possible Customer Matches" subtitle="Choose an existing customer or explicitly create a new customer." onClose={onCancel} footer={<div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-[10px] font-semibold">Cancel</button><button type="button" onClick={()=>onChoose(null)} className="rounded-xl bg-[#17365D] px-4 py-2.5 text-[10px] font-bold text-white">Create New Customer</button></div>}><div className="space-y-2">{candidates.map(candidate=><button type="button" key={candidate.id} onClick={()=>onChoose(candidate.id)} className="flex w-full items-center justify-between rounded-2xl border p-4 text-left"><div><p className="text-[11px] font-bold">{candidate.name}</p><p className="mt-1 text-[9px] text-[#667085]">{candidate.phone}</p></div><span className="rounded-lg bg-[#EEF4FB] px-3 py-2 text-[9px] font-bold">Use customer</span></button>)}</div></ModalShell>;}
function OwnershipModal({conflict,onResolve,onCancel}:{conflict:PolicyOwnershipConflict;onResolve:(decision:"keep_existing"|"transfer")=>void;onCancel:()=>void}){return <ModalShell title="Vehicle Ownership Conflict" subtitle={`${conflict.registrationNumber} is already linked to another customer.`} onClose={onCancel} footer={<div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-xl border px-4 py-2.5 text-[10px] font-semibold">Cancel</button><button type="button" onClick={()=>onResolve("keep_existing")} className="rounded-xl border px-4 py-2.5 text-[10px] font-bold">Keep Existing Customer</button>{conflict.canTransfer?<button type="button" onClick={()=>onResolve("transfer")} className="rounded-xl bg-amber-600 px-4 py-2.5 text-[10px] font-bold text-white">Confirm Ownership Transfer</button>:null}</div>}><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-[10px] font-bold">Current linked customer</p><p className="mt-2 text-[14px] font-bold">{conflict.customerName}</p></div></ModalShell>;}
function RcGroup({title,items}:{title:string;items:Array<[string,string|null]>}){const visible=items.filter(([,value])=>value&&value!=="NA");if(!visible.length)return null;return <div className="mt-5"><p className="mb-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#315B9A]">{title}</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{visible.map(([label,value])=><div key={label} className="rounded-xl border bg-[#F8FAFD] px-3 py-2.5"><p className="text-[7px] font-bold uppercase text-[#52749E]">{label}</p><p className="mt-1 text-[9.5px] font-semibold">{value}</p></div>)}</div></div>;}
