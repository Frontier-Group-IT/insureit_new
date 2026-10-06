"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Eye, LoaderCircle, Upload } from "lucide-react";
import { convertLifeHealthCaseToPolicy, uploadLifeHealthCaseDocument } from "@/app/policies/life-health-policy-actions";
import { updateLifeHealthCaseDetails } from "@/app/policies/life-health-case-edit-actions";

type CaseData={id:string;caseNumber:string;businessLine:"Life"|"Health";status:string;sourcingDate:string;customerId:string;customerName:string;customerPhone:string;customerAddress:string;insurerId:string;insurerName:string;productName:string;proposalNumber:string;ppt:string;pd:string;paymentFrequency:string;paymentMode:string;premiumAmount:number;intermediaryType:string;intermediaryCode:string;leadSource:string;intermediaryMobile:string;rmName:string;rmCode:string;remarks:string;finalPolicyId:string|null;finalPolicyNo:string|null;finalPolicyCode:string|null;convertedAt:string|null};
type DocumentRow={id:string;document_type:string;file_name:string;created_at:string};
type ActivityRow={id:string;action:string;createdAt:string;createdBy:string};
type Props={caseData:CaseData;insurers:Array<{id:string;name:string}>;documents:DocumentRow[];activities:ActivityRow[]};
type IssueState={policyNumber:string;issuanceDate:string;startDate:string;endDate:string;pptEndDate:string;nextInstallmentDate:string;finalPremium:string;sumInsured:string};
type OverrideState={endDate:boolean;pptEndDate:boolean;nextInstallmentDate:boolean};

const field="h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";
const readOnlyField=`${field} bg-[#F8FAFC] text-[#64748B]`;
const label="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const frequencies=["Monthly","Quarterly","Half Yearly","Annually","One Time"];
const modes=["Cheque","NEFT/RTGS","UPI","Credit/Debit Card","Net Banking"];
const today=()=>new Date().toISOString().slice(0,10);
const validIso=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);
const activityDate=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?"—":date.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})};

function yearsFromTerm(value:string){
  const normalized=value.trim().toLowerCase();
  if(!normalized||normalized.includes("single"))return null;
  const match=normalized.match(/(\d+(?:\.\d+)?)/);
  if(!match)return null;
  const years=Number(match[1]);
  return Number.isFinite(years)&&years>0?years:null;
}
function addYearsMinusDay(start:string,term:string){
  if(!validIso(start))return"";
  const years=yearsFromTerm(term);
  if(!years||!Number.isInteger(years))return"";
  const date=new Date(`${start}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear()+years);
  date.setUTCDate(date.getUTCDate()-1);
  return date.toISOString().slice(0,10);
}
function addMonthsClamped(start:string,months:number){
  if(!validIso(start))return"";
  const [y,m,d]=start.split("-").map(Number);
  const targetMonth=(m-1)+months;
  const targetYear=y+Math.floor(targetMonth/12);
  const monthIndex=((targetMonth%12)+12)%12;
  const lastDay=new Date(Date.UTC(targetYear,monthIndex+1,0)).getUTCDate();
  return new Date(Date.UTC(targetYear,monthIndex,Math.min(d,lastDay))).toISOString().slice(0,10);
}
function nextInstallmentFrom(start:string,frequency:string){
  if(!validIso(start)||frequency==="One Time")return"";
  if(frequency==="Monthly")return addMonthsClamped(start,1);
  if(frequency==="Quarterly")return addMonthsClamped(start,3);
  if(frequency==="Half Yearly")return addMonthsClamped(start,6);
  if(frequency==="Annually")return addMonthsClamped(start,12);
  return"";
}

export function LifeHealthCaseDetail({caseData,insurers,documents,activities}:Props){
  const router=useRouter(),isIssued=Boolean(caseData.finalPolicyId),docMap=useMemo(()=>new Map(documents.map(d=>[d.document_type,d])),[documents]);
  const[uploading,startUpload]=useTransition(),[converting,startConvert]=useTransition();
  const[error,setError]=useState<string|null>(null),[copy,setCopy]=useState<File|null>(null),[activityOpen,setActivityOpen]=useState(false),[remarksOpen,setRemarksOpen]=useState(false),[uploadingType,setUploadingType]=useState<string|null>(null);
  const[form,setForm]=useState({customerName:caseData.customerName,customerPhone:caseData.customerPhone,customerAddress:caseData.customerAddress,insurerId:caseData.insurerId,productName:caseData.productName,proposalNumber:caseData.proposalNumber,ppt:caseData.ppt,pd:caseData.pd,paymentFrequency:caseData.paymentFrequency,paymentMode:caseData.paymentMode,premiumAmount:String(caseData.premiumAmount||""),sourcingDate:caseData.sourcingDate,remarks:caseData.remarks});
  const initialStart=today();
  const[issue,setIssue]=useState<IssueState>({policyNumber:"",issuanceDate:today(),startDate:initialStart,endDate:addYearsMinusDay(initialStart,caseData.pd),pptEndDate:addYearsMinusDay(initialStart,caseData.ppt),nextInstallmentDate:nextInstallmentFrom(initialStart,caseData.paymentFrequency),finalPremium:String(caseData.premiumAmount||""),sumInsured:""});
  const[overrides,setOverrides]=useState<OverrideState>({endDate:false,pptEndDate:false,nextInstallmentDate:false});
  const set=(k:string,v:string)=>setForm(x=>({...x,[k]:v}));
  const setI=(k:keyof IssueState,v:string)=>setIssue(x=>({...x,[k]:v}));
  const expectedEnd=useMemo(()=>addYearsMinusDay(issue.startDate,form.pd),[issue.startDate,form.pd]);
  const expectedPptEnd=useMemo(()=>addYearsMinusDay(issue.startDate,form.ppt),[issue.startDate,form.ppt]);
  const expectedNext=useMemo(()=>nextInstallmentFrom(issue.startDate,form.paymentFrequency),[issue.startDate,form.paymentFrequency]);
  const pptSinglePay=form.ppt.trim().toLowerCase().includes("single");
  const oneTimePayment=form.paymentFrequency==="One Time";

  useEffect(()=>{if(!overrides.endDate)setIssue(x=>({...x,endDate:expectedEnd}));},[expectedEnd,overrides.endDate]);
  useEffect(()=>{if(!overrides.pptEndDate)setIssue(x=>({...x,pptEndDate:expectedPptEnd}));},[expectedPptEnd,overrides.pptEndDate]);
  useEffect(()=>{if(!overrides.nextInstallmentDate)setIssue(x=>({...x,nextInstallmentDate:expectedNext}));},[expectedNext,overrides.nextInstallmentDate]);

  const editData=()=>{const d=new FormData();d.set("caseId",caseData.id);Object.entries(form).forEach(([k,v])=>d.set(k,v));return d};
  const upload=(type:string,file:File|null)=>{if(!file)return;const d=new FormData();d.set("caseId",caseData.id);d.set("documentType",type);d.set("file",file);setUploadingType(type);startUpload(async()=>{try{const r=await uploadLifeHealthCaseDocument(d);if(!r.ok){setError(r.error);return}router.refresh()}finally{setUploadingType(null)}})};
  const convert=()=>{setError(null);startConvert(async()=>{const savedResult=await updateLifeHealthCaseDetails(editData());if(!savedResult.ok){setError(savedResult.error);return}const d=new FormData();d.set("caseId",caseData.id);Object.entries(issue).forEach(([k,v])=>d.set(k,v));if(copy)d.set("policyCopy",copy);const r=await convertLifeHealthCaseToPolicy(d);if(!r.ok){setError(r.error);return}router.replace("/policies")})};

  if(isIssued)return <div className="mx-auto max-w-[1480px] rounded-2xl border border-[#D9E2F0] bg-white p-5 text-[11px] text-[#17365D]">This case is issued and closed. <Link className="font-bold underline" href={`/policies/${caseData.finalPolicyId}`}>View Policy {caseData.finalPolicyNo}</Link></div>;

  const legacyCash=form.paymentMode==="Cash";
  return <div className="mx-auto w-full max-w-[1480px] space-y-3 pb-10">
    <div className="overflow-hidden rounded-t-xl border border-b-0 border-[#D9E2F0] bg-white shadow-[0_8px_22px_rgba(15,23,42,.05)]">
      <div className="flex min-h-[52px] items-center bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-4 py-2 text-white sm:px-5">
        <div className="flex w-full items-center justify-between gap-3"><div><h1 className="text-[15px] font-semibold tracking-[-0.01em]">Life / Health Case</h1><p className="mt-0.5 text-[9px] text-white/75">{caseData.customerName} · {caseData.proposalNumber}</p></div><Link href="/policies/life-health-cases" className="flex h-8 items-center justify-center rounded-lg border border-white/25 px-4 text-[9px] font-semibold hover:bg-white/10">Back</Link></div>
      </div>
    </div>

    <Section number="01" title="Policy source & ownership" contentClassName="md:grid-cols-2 xl:grid-cols-4">
      <FieldWrap title="Proposal date"><input type="date" className={field} value={form.sourcingDate} onChange={e=>set("sourcingDate",e.target.value)}/></FieldWrap>
      <FieldWrap title="Policy type"><input className={readOnlyField} value={caseData.businessLine} readOnly/></FieldWrap>
      <FieldWrap title="Intermediary type"><input className={readOnlyField} value={caseData.intermediaryType} readOnly/><MetaLine left={`RM · ${caseData.rmName||"—"}`} right={caseData.rmCode?`ID · ${caseData.rmCode}`:""}/></FieldWrap>
      <FieldWrap title="Lead source"><input className={readOnlyField} value={caseData.leadSource} readOnly/><MetaLine left={caseData.intermediaryCode?`ID · ${caseData.intermediaryCode}`:""} right={caseData.intermediaryMobile||""}/></FieldWrap>
    </Section>

    <Section number="02" title="Customer / proposer" contentClassName="md:grid-cols-2 xl:grid-cols-4">
      <FieldWrap title="Client / proposer name" required><input className={field} value={form.customerName} onChange={e=>set("customerName",e.target.value)}/></FieldWrap>
      <FieldWrap title="Client mobile number" required><input className={field} value={form.customerPhone} onChange={e=>set("customerPhone",e.target.value.replace(/\D/g,"").slice(0,10))} inputMode="numeric"/></FieldWrap>
      <div className="md:col-span-2 xl:col-span-2"><FieldWrap title="Address"><input className={field} value={form.customerAddress} onChange={e=>set("customerAddress",e.target.value)} placeholder="Customer address"/></FieldWrap></div>
    </Section>

    <Section number="03" title="Policy product & case details" contentClassName="md:grid-cols-2 xl:grid-cols-3">
      <FieldWrap title="Insurance company" required><select className={field} value={form.insurerId} onChange={e=>set("insurerId",e.target.value)}>{insurers.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</select></FieldWrap>
      <FieldWrap title="Product name" required><input className={field} value={form.productName} onChange={e=>set("productName",e.target.value)}/></FieldWrap>
      <FieldWrap title="Case / proposal number" required><input className={field} value={form.proposalNumber} onChange={e=>set("proposalNumber",e.target.value.toUpperCase())}/></FieldWrap>
      <FieldWrap title="PPT · Premium Paying Term"><input className={field} value={form.ppt} onChange={e=>set("ppt",e.target.value)} placeholder="e.g. 10 Years or Single Pay"/></FieldWrap>
      <FieldWrap title="PD · Policy Duration / Term"><input className={field} value={form.pd} onChange={e=>set("pd",e.target.value)} placeholder="e.g. 20 Years"/></FieldWrap>
      <FieldWrap title="Payment frequency" required><select className={field} value={form.paymentFrequency} onChange={e=>set("paymentFrequency",e.target.value)}>{frequencies.map(v=><option key={v}>{v}</option>)}</select></FieldWrap>
    </Section>

    <Section number="04" title="Premium & payment" contentClassName="md:grid-cols-2 xl:grid-cols-3">
      <FieldWrap title="Premium amount" required><input className={field} value={form.premiumAmount} onChange={e=>set("premiumAmount",e.target.value.replace(/[^0-9.]/g,""))} inputMode="decimal"/></FieldWrap>
      <FieldWrap title="Payment mode" required><select className={field} value={form.paymentMode} onChange={e=>set("paymentMode",e.target.value)}>{legacyCash?<option value="Cash" disabled>Cash (legacy case)</option>:null}{modes.map(v=><option key={v}>{v}</option>)}</select></FieldWrap>
      <FieldWrap title="Remarks"><input className={field} value={form.remarks} onChange={e=>set("remarks",e.target.value)} placeholder="Optional servicing / underwriting note"/></FieldWrap>
    </Section>

    <Section number="05" title="Mark Policy Issued" highlight contentClassName="md:grid-cols-2 xl:grid-cols-4">
      <FieldWrap title="Policy number" required><input className={field} value={issue.policyNumber} onChange={e=>setI("policyNumber",e.target.value.toUpperCase())}/></FieldWrap>
      <FieldWrap title="Issuance date"><input type="date" className={field} value={issue.issuanceDate} onChange={e=>setI("issuanceDate",e.target.value)}/></FieldWrap>
      <FieldWrap title="Policy start date"><input type="date" className={field} value={issue.startDate} onChange={e=>{setOverrides({endDate:false,pptEndDate:false,nextInstallmentDate:false});setI("startDate",e.target.value)}}/></FieldWrap>
      <CalculatedDateField title="Policy end / maturity date" value={issue.endDate} expected={expectedEnd} overridden={overrides.endDate} onChange={value=>{setOverrides(x=>({...x,endDate:true}));setI("endDate",value)}} missingHint={!expectedEnd&&Boolean(issue.startDate)?"Enter Policy Duration / Term in years to calculate automatically.":undefined}/>
      {pptSinglePay?<ReadOnlyTextField title="PPT end date" value="Not applicable · Single Pay"/>:<CalculatedDateField title="PPT end date" value={issue.pptEndDate} expected={expectedPptEnd} overridden={overrides.pptEndDate} onChange={value=>{setOverrides(x=>({...x,pptEndDate:true}));setI("pptEndDate",value)}} missingHint={!expectedPptEnd&&Boolean(issue.startDate)?"Enter PPT in years to calculate automatically.":undefined}/>}
      {oneTimePayment?<ReadOnlyTextField title="Next installment date" value="Not applicable · One Time"/>:<CalculatedDateField title="Next installment date" value={issue.nextInstallmentDate} expected={expectedNext} overridden={overrides.nextInstallmentDate} onChange={value=>{setOverrides(x=>({...x,nextInstallmentDate:true}));setI("nextInstallmentDate",value)}}/>}
      <FieldWrap title="Final premium"><input className={field} value={issue.finalPremium} onChange={e=>setI("finalPremium",e.target.value.replace(/[^0-9.]/g,""))}/></FieldWrap>
      <FieldWrap title="Sum assured / insured"><input className={field} value={issue.sumInsured} onChange={e=>setI("sumInsured",e.target.value.replace(/[^0-9.]/g,""))}/></FieldWrap>
    </Section>

    <section className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-white"><button type="button" onClick={()=>setActivityOpen(v=>!v)} className="flex w-full items-center justify-between px-4 py-3 text-left text-[11px] font-semibold text-[#17365D]"><span>Activity Status</span><ChevronDown className={`h-4 w-4 transition-transform ${activityOpen?"rotate-180":""}`}/></button>{activityOpen?<div className="border-t p-4"><div className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-[#FBFCFE]">{activities.map((activity,index)=><div key={activity.id} className={`grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_260px_190px] md:items-center ${index?"border-t border-[#D9E2F0]":""}`}><div><p className="text-[8px] font-bold uppercase tracking-[.06em] text-[#8090A5]">{index===0?"Latest Action":"Previous Action"}</p><p className="mt-1 text-[12px] font-semibold text-[#17365D]">{activity.action}</p></div><p className="text-[9px] text-[#7A8AA0] md:text-right">Details: Created By: <span className="font-medium text-[#53657D]">{activity.createdBy}</span></p><p className="text-[9px] text-[#7A8AA0] md:text-right">At: {activityDate(activity.createdAt)}</p></div>)}</div></div>:null}</section>
    <section className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-white"><button type="button" onClick={()=>setRemarksOpen(v=>!v)} className="flex w-full items-center justify-between px-4 py-3 text-left text-[11px] font-semibold text-[#17365D]"><span>Remarks / Activity Note</span><ChevronDown className={`h-4 w-4 transition-transform ${remarksOpen?"rotate-180":""}`}/></button>{remarksOpen?<div className="border-t p-4"><textarea className={`${field} h-20 py-2`} aria-label="Remarks / activity note" value={form.remarks} onChange={e=>set("remarks",e.target.value)}/></div>:null}</section>

    {error?<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">{error}</div>:null}
    <section className="rounded-xl border border-[#D9E2F0] bg-white px-3 py-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><UploadAction label="Add Policy Copy" type="policy_copy" existing={docMap.get("policy_copy")} disabled={uploading} loading={uploadingType==="policy_copy"} onUpload={(type,file)=>{setCopy(file);upload(type,file)}}/><UploadAction label="Add Proposal Form" type="proposal_form" existing={docMap.get("proposal_form")} disabled={uploading} loading={uploadingType==="proposal_form"} onUpload={upload}/><UploadAction label="Add Illustration Form" type="benefit_illustration" existing={docMap.get("benefit_illustration")} disabled={uploading} loading={uploadingType==="benefit_illustration"} onUpload={upload}/><UploadAction label="Add Payment Receipt" type="premium_receipt" existing={docMap.get("premium_receipt")} disabled={uploading} loading={uploadingType==="premium_receipt"} onUpload={upload}/><UploadAction label="Add Other Form" type="other_document" existing={docMap.get("other_document")} disabled={uploading} loading={uploadingType==="other_document"} onUpload={upload}/></div><div className="flex items-center gap-2"><Link href="/policies/life-health-cases" className="flex h-10 items-center justify-center rounded-xl border border-[#CAD7E7] bg-white px-5 text-[9px] font-semibold text-[#17365D]">Cancel</Link><button type="button" onClick={convert} disabled={converting} className="h-10 rounded-xl bg-[#17365D] px-5 text-[9px] font-bold text-white disabled:opacity-60">{converting?"Creating…":"Create Policy & Close Case"}</button></div></div></section>
  </div>
}

function Section({number,title,children,highlight=false,contentClassName="md:grid-cols-2 xl:grid-cols-4"}:{number:string;title:string;children:ReactNode;highlight?:boolean;contentClassName?:string}){return <section className={`overflow-visible rounded-2xl border shadow-sm ${highlight?"border-[#DDD6FE] bg-[#FAF8FF]":"border-[#D9E2F0] bg-white"}`}><div className={`flex min-h-11 items-center border-b px-4 py-2 ${highlight?"border-[#DDD6FE] bg-[#F5F3FF]":"bg-[#FBFCFE]"}`}><div className="flex items-center gap-3"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[9px] font-bold text-white ${highlight?"bg-[#6D5BD0]":"bg-[#17365D]"}`}>{number}</span><div><h2 className="text-[12px] font-semibold leading-tight text-[#17203A]">{title}</h2>{highlight?<p className="mt-0.5 text-[8px] text-[#7C739E]">Actual issued-policy credentials</p>:null}</div></div></div><div className={`grid gap-3 p-3 ${contentClassName}`}>{children}</div></section>}
function FieldWrap({title,children,required=false}:{title:string;children:ReactNode;required?:boolean}){return <label><span className={label}>{title}{required?<span className="text-red-500">*</span>:null}</span>{children}</label>}
function MetaLine({left,right}:{left:string;right:string}){if(!left&&!right)return null;return <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 text-[9px] font-semibold text-[#315B6B]"><span>{left}</span>{right?<span>{right}</span>:null}</div>}
function ReadOnlyTextField({title,value}:{title:string;value:string}){return <FieldWrap title={title}><div className={`${readOnlyField} flex items-center`}>{value}</div></FieldWrap>}
function CalculatedDateField({title,value,expected,overridden,onChange,missingHint}:{title:string;value:string;expected:string;overridden:boolean;onChange:(value:string)=>void;missingHint?:string}){const differs=Boolean(overridden&&expected&&value&&value!==expected);return <FieldWrap title={title}><input type="date" className={field} value={value} onChange={e=>onChange(e.target.value)}/>{differs?<p className="mt-1 text-[8px] leading-3 text-[#9A6700]">Manually changed from the calculated date {formatDate(expected)}. Please verify before issuing.</p>:missingHint?<p className="mt-1 text-[8px] leading-3 text-[#7A869A]">{missingHint}</p>:<p className="mt-1 text-[8px] leading-3 text-[#7A869A]">Auto-calculated and editable.</p>}</FieldWrap>}
function formatDate(value:string){if(!validIso(value))return value;const[y,m,d]=value.split("-");return`${d}/${m}/${y}`}
function UploadAction({label:buttonLabel,type,existing,disabled,loading,onUpload}:{label:string;type:string;existing?:DocumentRow;disabled:boolean;loading:boolean;onUpload:(type:string,file:File|null)=>void}){
  if(!existing)return <label title={buttonLabel} className={`flex h-10 items-center gap-2 rounded-xl border border-[#CAD7E7] bg-white px-4 text-[9px] font-semibold text-[#24569A] ${disabled?"cursor-wait opacity-70":"cursor-pointer"}`}><Upload className="h-3.5 w-3.5"/><span>{loading?"Uploading…":buttonLabel}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={disabled} className="hidden" onChange={e=>onUpload(type,e.target.files?.[0]??null)}/></label>;
  return <div className={`inline-flex h-10 overflow-hidden rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 ${disabled?"opacity-70":""}`}><label title={existing.file_name} className={`inline-flex items-center gap-2 px-4 text-[9px] font-semibold transition hover:bg-emerald-100/60 ${disabled?"cursor-wait":"cursor-pointer"}`}>{loading?<LoaderCircle className="h-3.5 w-3.5 animate-spin"/>:<Upload className="h-3.5 w-3.5"/>}<span>{loading?"Uploading…":buttonLabel.replace("Add ","Replace ")}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={disabled} className="hidden" onChange={e=>onUpload(type,e.target.files?.[0]??null)}/></label><a href={`/policies/life-health-case-documents/${existing.id}/view`} target="_blank" rel="noreferrer" aria-label={`View ${buttonLabel.replace("Add ","")}`} title={`View ${existing.file_name}`} className="grid w-9 shrink-0 place-items-center border-l border-emerald-200 transition hover:bg-emerald-100/60"><Eye className="h-3.5 w-3.5" aria-hidden="true"/></a></div>;
}
