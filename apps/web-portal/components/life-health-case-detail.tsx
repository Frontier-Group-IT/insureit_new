"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { FileSizeExceededPopup } from "@/components/file-size-exceeded-popup";
import { CalendarDays, FileText, RefreshCw, LoaderCircle, Trash2, Upload, ShieldCheck, MessageSquareText, Save, ArrowRight, X } from "lucide-react";
import { convertLifeHealthCaseToPolicy, deleteLifeHealthCaseDocument, uploadLifeHealthCaseDocument } from "@/app/policies/life-health-policy-actions";
import { appendLifeHealthCaseRemark, updateLifeHealthCaseDetails } from "@/app/policies/life-health-case-edit-actions";
import { rejectLifeHealthCase } from "@/app/policies/life-health-case-reject-actions";
import { isPensionLifePolicy } from "@/lib/life-health-pension-maturity";
import { PolicyDateApprovalDialog } from "@/components/policy-date-approval-dialog";
import { policyDateDecision } from "@/lib/policy-date-rule";

type CaseData={id:string;caseNumber:string;businessLine:"Life"|"Health";status:string;sourcingDate:string;customerId:string;customerName:string;customerPhone:string;customerAddress:string;insurerId:string;insurerName:string;productName:string;proposalNumber:string;ppt:string;pd:string;paymentFrequency:string;paymentMode:string;premiumAmount:number;intermediaryType:string;intermediaryCode:string;leadSource:string;intermediaryMobile:string;rmName:string;rmCode:string;remarks:string;finalPolicyId:string|null;finalPolicyNo:string|null;finalPolicyCode:string|null;convertedAt:string|null};
type DocumentRow={id:string;document_type:string;file_name:string;created_at:string};
type ActivityRow={id:string;action:string;createdAt:string;createdBy:string;changes?:string[]};
type Props={caseData:CaseData;insurers:Array<{id:string;name:string}>;documents:DocumentRow[];activities:ActivityRow[]};
type IssueState={policyNumber:string;issuanceDate:string;startDate:string;endDate:string;pptEndDate:string;nextInstallmentDate:string;finalPremium:string;sumInsured:string};
type OverrideState={endDate:boolean;pptEndDate:boolean;nextInstallmentDate:boolean};

const field="h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";
const readOnlyField=`${field} bg-[#F8FAFC] text-[#64748B]`;
const label="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const frequencies=["Monthly","Quarterly","Half Yearly","Annually","One Time"];
const modes=["Cheque","NEFT/RTGS","UPI","Credit/Debit Card","Net Banking"];
const YEAR_OPTIONS=Array.from({length:100},(_,index)=>`${index+1} Year${index===0?"":"s"}`);
const termOptions=(current:string,includeSinglePay:boolean)=>[...((current && current!=="Single Pay"&&!YEAR_OPTIONS.includes(current))?[current]:[]),...(includeSinglePay?["Single Pay"]:[]),...YEAR_OPTIONS];
const normalizeCasePaymentMode=(value:string)=>{
  const normalized=value.trim().replace(/\s+/g," ").toLowerCase();
  return [...modes,"Cash"].find(mode=>mode.toLowerCase()===normalized)??"";
};
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
type DateCalculationMode="minusOne"|"sameDay";
function addYearsByMode(start:string,term:string,mode:DateCalculationMode){
  if(!validIso(start))return"";
  const years=yearsFromTerm(term);
  if(!years||!Number.isInteger(years))return"";
  const date=new Date(`${start}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear()+years);
  if(mode==="minusOne")date.setUTCDate(date.getUTCDate()-1);
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
function canonicalPaymentFrequency(value:string){
  const normalized=value.trim().toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ");
  if(normalized==="monthly"||normalized==="month")return"Monthly";
  if(normalized==="quarterly"||normalized==="quarter")return"Quarterly";
  if(normalized==="half yearly"||normalized==="half year"||normalized==="semi annual"||normalized==="semi annually"||normalized==="semiannual")return"Half Yearly";
  if(normalized==="annual"||normalized==="annually"||normalized==="yearly"||normalized==="year")return"Annually";
  if(normalized==="one time"||normalized==="single"||normalized==="single pay")return"One Time";
  return value.trim();
}
function nextInstallmentFrom(start:string,frequency:string){
  if(!validIso(start))return"";
  const canonical=canonicalPaymentFrequency(frequency);
  if(canonical==="One Time")return"";
  if(canonical==="Monthly")return addMonthsClamped(start,1);
  if(canonical==="Quarterly")return addMonthsClamped(start,3);
  if(canonical==="Half Yearly")return addMonthsClamped(start,6);
  if(canonical==="Annually")return addMonthsClamped(start,12);
  return"";
}

export function LifeHealthCaseDetail({caseData,insurers,documents,activities}:Props){
  const router=useRouter(),isIssued=Boolean(caseData.finalPolicyId),docMap=useMemo(()=>new Map(documents.map(d=>[d.document_type,d])),[documents]);
  const[uploading,startUpload]=useTransition(),[converting,startConvert]=useTransition(),[saving,startSave]=useTransition(),[deleting,startDelete]=useTransition();
  const[documentToDelete,setDocumentToDelete]=useState<DocumentRow|null>(null),[deleteError,setDeleteError]=useState<string|null>(null),[deletingDocumentId,setDeletingDocumentId]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[saveSuccess,setSaveSuccess]=useState(false),[copy,setCopy]=useState<File|null>(null),[uploadingType,setUploadingType]=useState<string|null>(null);
  const[form,setForm]=useState({customerName:caseData.customerName,customerPhone:caseData.customerPhone,customerAddress:caseData.customerAddress,insurerId:caseData.insurerId,productName:caseData.productName,proposalNumber:caseData.proposalNumber,ppt:caseData.ppt,pd:caseData.pd,paymentFrequency:canonicalPaymentFrequency(caseData.paymentFrequency),paymentMode:normalizeCasePaymentMode(caseData.paymentMode),premiumAmount:String(caseData.premiumAmount||""),sourcingDate:caseData.sourcingDate});
  const[infoTab,setInfoTab]=useState<"activity"|"remarks"|null>(null);
  const[savedRemarks,setSavedRemarks]=useState(caseData.remarks);
  const[remarkOpen,setRemarkOpen]=useState(false);
  const[remarkDraft,setRemarkDraft]=useState("");
  const[remarkError,setRemarkError]=useState<string|null>(null);
  const[remarkPending,startRemark]=useTransition();
  const[rejectOpen,setRejectOpen]=useState(false);
  const[rejectReason,setRejectReason]=useState("");
  const[rejectError,setRejectError]=useState<string|null>(null);
  const[rejectPending,startReject]=useTransition();
  const[issuedApproval,setIssuedApproval]=useState<{id:string;key:string}|null>(null);
  const[dateApprovalOpen,setDateApprovalOpen]=useState(false);
  const[issue,setIssue]=useState<IssueState>({policyNumber:"",issuanceDate:"",startDate:"",endDate:"",pptEndDate:"",nextInstallmentDate:"",finalPremium:String(caseData.premiumAmount||""),sumInsured:""});
  const[overrides,setOverrides]=useState<OverrideState>({endDate:false,pptEndDate:false,nextInstallmentDate:false});
  const[endDateMode,setEndDateMode]=useState<DateCalculationMode>("minusOne");
  const[pptEndDateMode,setPptEndDateMode]=useState<DateCalculationMode>("minusOne");
  const set=(k:string,v:string)=>setForm(x=>({...x,[k]:v}));
  const setI=(k:keyof IssueState,v:string)=>setIssue(x=>({...x,[k]:v}));
  const issueApprovalKey=issue.issuanceDate+":"+issue.policyNumber.trim().toUpperCase();
  const dateApprovalId=issuedApproval?.key===issueApprovalKey?issuedApproval.id:null;
  const issueApprovalRequired=policyDateDecision(issue.issuanceDate)==="otp_required";
  const pensionPlan=isPensionLifePolicy(caseData.businessLine,form.productName);
  const expectedEnd=useMemo(()=>addYearsByMode(issue.startDate,form.pd,endDateMode),[issue.startDate,form.pd,endDateMode]);
  const expectedPptEnd=useMemo(()=>addYearsByMode(issue.startDate,form.ppt,pptEndDateMode),[issue.startDate,form.ppt,pptEndDateMode]);
  const expectedNext=useMemo(()=>nextInstallmentFrom(issue.startDate,form.paymentFrequency),[issue.startDate,form.paymentFrequency]);
  const pptSinglePay=form.ppt.trim().toLowerCase().includes("single");
  const oneTimePayment=canonicalPaymentFrequency(form.paymentFrequency)==="One Time";

  useEffect(()=>{if(!overrides.endDate)setIssue(x=>({...x,endDate:pensionPlan?"":expectedEnd}));},[expectedEnd,overrides.endDate,pensionPlan]);
  useEffect(()=>{if(!overrides.pptEndDate)setIssue(x=>({...x,pptEndDate:expectedPptEnd}));},[expectedPptEnd,overrides.pptEndDate]);
  useEffect(()=>{if(!overrides.nextInstallmentDate)setIssue(x=>({...x,nextInstallmentDate:expectedNext}));},[expectedNext,overrides.nextInstallmentDate]);

  const editData=()=>{const d=new FormData();d.set("caseId",caseData.id);Object.entries(form).forEach(([k,v])=>d.set(k,v));return d};
  const saveDetails=()=>{setError(null);setSaveSuccess(false);startSave(async()=>{try{const result=await updateLifeHealthCaseDetails(editData());if(!result.ok){setError(result.error);return}setSaveSuccess(true);router.refresh()}catch{setError("Could not save case details. Please retry.")}})};
  const addRemark=()=>{
    if(!remarkDraft.trim()||remarkPending)return;
    setRemarkError(null);
    startRemark(async()=>{
      try{
        const data=new FormData();
        data.set("caseId",caseData.id);
        data.set("newRemark",remarkDraft.trim());
        const result=await appendLifeHealthCaseRemark(data);
        if(!result.ok){setRemarkError(result.error);return;}
        setSavedRemarks(result.remarks);
        setRemarkDraft("");
        setRemarkOpen(false);
        setInfoTab("remarks");
        router.refresh();
      }catch{setRemarkError("Could not add remark. Reload and check saved remarks before retrying.");}
    });
  };
  const [oversizedLimitMb,setOversizedLimitMb]=useState<number|null>(null);
  const upload=(type:string,file:File|null)=>{if(!file)return;setError(null);if(!file.size){setError("Choose a non-empty document.");return}if(file.size>4*1024*1024){setOversizedLimitMb(4);return}if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(file.type)){setError("Upload a PDF, JPG, PNG or WebP document.");return}const d=new FormData();d.set("caseId",caseData.id);d.set("documentType",type);d.set("file",file);setUploadingType(type);startUpload(async()=>{try{const r=await uploadLifeHealthCaseDocument(d);if(!r.ok){setError(r.error);return}router.refresh()}catch(error){console.error("Life/Health document upload failed",error);setError(/UnrecognizedActionError|Server Action .* was not found|unexpected response was received from the server/i.test(error instanceof Error ? `${error.name} ${error.message}` : String(error)) ? "The portal version changed while this page was open. Reload the page, check whether the document was already uploaded, and try again if needed." : "The upload request failed before the server returned a response. Please reload the page and retry. If it continues, contact support.")}finally{setUploadingType(null)}})};
  const deleteDocument=(document:DocumentRow)=>{setDeleteError(null);setDocumentToDelete(document)};
  const confirmDocumentDelete=()=>{if(!documentToDelete||deleting)return;const document=documentToDelete;setDeleteError(null);setDeletingDocumentId(document.id);startDelete(async()=>{try{const result=await deleteLifeHealthCaseDocument(caseData.id,document.id);if(!result.ok){setDeleteError(result.error);return}setDocumentToDelete(null);router.refresh()}catch(cause){setDeleteError(cause instanceof Error?cause.message:"Could not delete the document. Please retry.")}finally{setDeletingDocumentId(null)}})};
  const convert=(approvalConfirmed=false)=>{setError(null);if(["invalid","future"].includes(policyDateDecision(issue.issuanceDate))){setError("Choose a valid policy issuance date in the current or an earlier month.");return;}if(!issue.policyNumber.trim()||!issue.startDate||!issue.finalPremium){setError("Complete the issued policy number, policy start date, and final premium before approval.");return;}if(issueApprovalRequired){if(!approvalConfirmed){setDateApprovalOpen(true);return;}if(!dateApprovalId){setDateApprovalOpen(true);return;}setDateApprovalOpen(false);}startConvert(async()=>{const savedResult=await updateLifeHealthCaseDetails(editData());if(!savedResult.ok){setError(savedResult.error);return}const d=new FormData();d.set("caseId",caseData.id);Object.entries(issue).forEach(([k,v])=>d.set(k,v));if(dateApprovalId)d.set("dateApprovalId",dateApprovalId);if(copy)d.set("policyCopy",copy);const r=await convertLifeHealthCaseToPolicy(d);if(!r.ok){setError(r.error);return}router.replace("/policies")})};

  const confirmReject=()=>{
    if(!rejectReason.trim()||rejectPending)return;
    setRejectError(null);
    startReject(async()=>{
      try{
        const result=await rejectLifeHealthCase(caseData.id,rejectReason);
        if(!result.ok){setRejectError(result.error);return;}
        setRejectOpen(false);
        router.replace("/policies/life-health-cases?status=rejected");
        router.refresh();
      }catch{setRejectError("Could not reject this case. Refresh the page and try again.");}
    });
  };

  if(caseData.status==="rejected")return <div className="mx-auto max-w-[1480px] rounded-2xl border border-red-200 bg-white p-5 text-[11px] text-[#17365D]"><h2 className="text-[15px] font-bold text-red-700">Case Rejected</h2><p className="mt-2">This case is rejected and cannot be issued.</p><p className="mt-3 whitespace-pre-wrap rounded-xl bg-red-50 p-3 text-[11px] text-[#475467]">{caseData.remarks||"No rejection remarks available."}</p><Link className="mt-4 inline-block font-bold underline" href="/policies/life-health-cases?status=rejected">Back to Rejected cases</Link></div>;
  if(isIssued)return <div className="mx-auto max-w-[1480px] rounded-2xl border border-[#D9E2F0] bg-white p-5 text-[11px] text-[#17365D]">This case is issued and closed. <Link className="font-bold underline" href={`/policies/${encodeURIComponent(caseData.finalPolicyId!)}/edit`}>View Policy {caseData.finalPolicyNo}</Link></div>;

  const legacyCash=form.paymentMode==="Cash";
  return <div className="mx-auto w-full max-w-[1480px] space-y-3 pb-10">
    {rejectOpen?<div className="fixed inset-0 z-[1200] grid h-[100dvh] w-screen place-items-center bg-[#101828]/60 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="reject-case-title" className="w-full max-w-[480px] rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-[#E6ECF5] px-5 py-4"><h2 id="reject-case-title" className="text-[15px] font-bold text-[#17365D]">Reject Life / Health Case?</h2><p className="mt-1 text-[11px] text-[#667085]">Case {caseData.caseNumber} will move to Rejected. A reason is required.</p></div>
        <div className="space-y-2 p-5"><label htmlFor="life-health-rejection-reason" className="text-[10px] font-bold text-[#475467]">Reason for rejection <span className="text-red-600">*</span></label><textarea id="life-health-rejection-reason" autoFocus value={rejectReason} onChange={event=>setRejectReason(event.target.value)} maxLength={2000} rows={4} placeholder="Enter the reason for rejecting this case..." className="w-full resize-y rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-[12px] text-[#17203A] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]"/>{rejectError?<p role="alert" className="text-[11px] font-semibold text-red-700">{rejectError}</p>:null}</div>
        <div className="flex justify-end gap-2 border-t border-[#E6ECF5] bg-[#F8FAFC] p-4"><button type="button" disabled={rejectPending} onClick={()=>{setRejectOpen(false);setRejectReason("");setRejectError(null)}} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10px] font-semibold">Cancel</button><button type="button" disabled={rejectPending||!rejectReason.trim()} onClick={confirmReject} className="rounded-xl bg-[#C42B31] px-5 py-2.5 text-[10px] font-bold text-white disabled:opacity-50">{rejectPending?"Rejecting…":"Confirm Reject"}</button></div>
      </div>
    </div>:null}
    {documentToDelete?<div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101828]/55 p-4" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget&&!deleting)setDocumentToDelete(null)}}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-document-title" aria-describedby="delete-document-message" className="w-full max-w-[430px] rounded-[24px] bg-white px-6 pb-6 pt-7 text-center shadow-[0_24px_70px_rgba(16,24,40,0.25)]">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#FFF0F0] text-[#C22B30]"><Trash2 className="h-7 w-7" aria-hidden="true"/></span>
        <h2 id="delete-document-title" className="mt-4 text-[23px] font-extrabold tracking-tight text-[#182237]">Delete document?</h2>
        <p id="delete-document-message" className="mt-3 text-[14px] leading-6 font-semibold text-[#667085]">Are you sure you want to delete<br/><span className="break-all">{documentToDelete.file_name}</span>?</p>
        {deleteError?<p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-left text-[12px] font-semibold text-red-700">{deleteError}</p>:null}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" disabled={deleting} onClick={()=>{setDocumentToDelete(null);setDeleteError(null)}} className="h-12 rounded-xl border border-[#CBD5E1] bg-white text-[14px] font-bold text-[#142747] hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={deleting} onClick={confirmDocumentDelete} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#C42B31] text-[14px] font-bold text-white hover:bg-[#AC2329] disabled:opacity-60">{deleting?<><LoaderCircle className="h-4 w-4 animate-spin"/>Deleting…</>:"Delete"}</button>
        </div>
      </div>
    </div>:null}
    <div className="overflow-hidden rounded-t-xl border border-b-0 border-[#D9E2F0] bg-white shadow-[0_8px_22px_rgba(15,23,42,.05)]">
      <div className="flex min-h-[52px] items-center bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-4 py-2 text-white sm:px-5">
        <div className="flex w-full items-center justify-between gap-3"><div><h1 className="text-[15px] font-semibold tracking-[-0.01em]">Life / Health Case</h1><p className="mt-0.5 text-[9px] text-white/75">{caseData.customerName} · {caseData.proposalNumber}</p></div><Link href="/policies/life-health-cases" className="flex h-8 items-center justify-center rounded-lg border border-white/25 px-4 text-[9px] font-semibold hover:bg-white/10">Back</Link></div>
      </div>
    </div>

    <Section number="01" title="Policy source & ownership" contentClassName="md:grid-cols-2 xl:grid-cols-4">
      <FieldWrap title="Proposal date"><DateInput value={form.sourcingDate} onChange={value=>set("sourcingDate",value)}/></FieldWrap>
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
      <FieldWrap title="PPT · Premium Paying Term"><select className={field} value={form.ppt} onChange={e=>{set("ppt",e.target.value);setSaveSuccess(false)}}><option value="">Select term</option>{termOptions(form.ppt,true).map(item=><option key={item} value={item}>{item}</option>)}</select></FieldWrap>
      <FieldWrap title="PD · Policy Duration / Term"><select className={field} value={form.pd} onChange={e=>{set("pd",e.target.value);setSaveSuccess(false)}}><option value="">Select term</option>{termOptions(form.pd,false).map(item=><option key={item} value={item}>{item}</option>)}</select></FieldWrap>
      <FieldWrap title="Payment frequency" required><select className={field} value={form.paymentFrequency} onChange={e=>set("paymentFrequency",e.target.value)}>{frequencies.map(v=><option key={v}>{v}</option>)}</select></FieldWrap>
    </Section>

    <Section number="04" title="Premium & payment" contentClassName="md:grid-cols-2 xl:grid-cols-3" premium>
      <FieldWrap title="Premium amount" required><input className={field} value={form.premiumAmount} onChange={e=>set("premiumAmount",e.target.value.replace(/[^0-9.]/g,""))} inputMode="decimal"/></FieldWrap>
      <FieldWrap title="Payment mode" required><select className={field} value={form.paymentMode} onChange={e=>set("paymentMode",e.target.value)}><option value="" disabled>Select payment mode</option>{legacyCash?<option value="Cash" disabled>Cash (legacy case)</option>:null}{modes.map(v=><option key={v} value={v}>{v}</option>)}</select></FieldWrap>
      <FieldWrap title="Remarks"><button type="button" onClick={()=>{setRemarkError(null);setRemarkOpen(true);}} disabled={saving||converting||remarkPending} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#BFD3F5] bg-[#EFF5FF] px-3 text-[11px] font-semibold text-[#17365D] hover:bg-[#E2EEFF] disabled:opacity-50"><MessageSquareText className="h-4 w-4"/>Add Remark</button></FieldWrap>
    </Section>

    <Section number="05" title="Mark Policy Issued" highlight contentClassName="md:grid-cols-2 xl:grid-cols-4">
      <FieldWrap title="Policy number" required><input className={field} value={issue.policyNumber} onChange={e=>setI("policyNumber",e.target.value.toUpperCase())}/></FieldWrap>
      <FieldWrap title="Issuance date"><DateInput value={issue.issuanceDate} onChange={value=>setI("issuanceDate",value)}/></FieldWrap>
      <FieldWrap title="Policy start date"><DateInput value={issue.startDate} onChange={value=>{setOverrides({endDate:false,pptEndDate:false,nextInstallmentDate:false});setI("startDate",value)}}/></FieldWrap>
      <CalculatedDateField title="Policy end / maturity date" value={issue.endDate} expected={expectedEnd} overridden={overrides.endDate} mode={endDateMode} onModeChange={setEndDateMode} onChange={value=>{setOverrides(x=>({...x,endDate:true}));setI("endDate",value)}} missingHint={pensionPlan?"Optional. Leave blank if there is no fixed maturity date.":!expectedEnd&&Boolean(issue.startDate)?"Optional. Enter Policy Duration / Term in years to calculate automatically.":undefined}/>
      {pptSinglePay?<ReadOnlyTextField title="PPT end date" value="Not applicable · Single Pay"/>:<CalculatedDateField title="PPT end date" value={issue.pptEndDate} expected={expectedPptEnd} overridden={overrides.pptEndDate} mode={pptEndDateMode} onModeChange={setPptEndDateMode} onChange={value=>{setOverrides(x=>({...x,pptEndDate:true}));setI("pptEndDate",value)}} missingHint={!expectedPptEnd&&Boolean(issue.startDate)?"Enter PPT in years to calculate automatically.":undefined}/>}
      {oneTimePayment?<ReadOnlyTextField title="Next installment date" value="Not applicable · One Time"/>:<CalculatedDateField title="Next installment date" value={issue.nextInstallmentDate} expected={expectedNext} overridden={overrides.nextInstallmentDate} onChange={value=>{setOverrides(x=>({...x,nextInstallmentDate:true}));setI("nextInstallmentDate",value)}}/>}
      <FieldWrap title="Final premium"><input className={field} value={issue.finalPremium} onChange={e=>setI("finalPremium",e.target.value.replace(/[^0-9.]/g,""))}/></FieldWrap>
      <FieldWrap title="Sum assured / insured"><input className={field} value={issue.sumInsured} onChange={e=>setI("sumInsured",e.target.value.replace(/[^0-9.]/g,""))}/></FieldWrap>
    </Section>

    <section aria-label="Documents" className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
      <div className="border-b border-[#D9E2F0] bg-[#FBFCFE] px-4 py-3">
        <h2 className="text-[13px] font-bold text-[#172D53]">Documents</h2>
      </div>
      <div className="p-4">
        <div role="group" aria-label="Case documents" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      <UploadAction label="Add Policy Copy" type="policy_copy" existing={docMap.get("policy_copy")} disabled={uploading||deleting} deleting={deletingDocumentId===docMap.get("policy_copy")?.id} onDelete={deleteDocument} loading={uploadingType==="policy_copy"} onUpload={(type,file)=>{setCopy(file);upload(type,file)}}/><UploadAction label="Add Proposal Form" type="proposal_form" existing={docMap.get("proposal_form")} disabled={uploading||deleting} deleting={deletingDocumentId===docMap.get("proposal_form")?.id} onDelete={deleteDocument} loading={uploadingType==="proposal_form"} onUpload={upload}/><UploadAction label="Add Illustration Form" type="benefit_illustration" existing={docMap.get("benefit_illustration")} disabled={uploading||deleting} deleting={deletingDocumentId===docMap.get("benefit_illustration")?.id} onDelete={deleteDocument} loading={uploadingType==="benefit_illustration"} onUpload={upload}/><UploadAction label="Add Payment Receipt" type="premium_receipt" existing={docMap.get("premium_receipt")} disabled={uploading||deleting} deleting={deletingDocumentId===docMap.get("premium_receipt")?.id} onDelete={deleteDocument} loading={uploadingType==="premium_receipt"} onUpload={upload}/><UploadAction label="Add Other Form" type="other_document" existing={docMap.get("other_document")} disabled={uploading||deleting} deleting={deletingDocumentId===docMap.get("other_document")?.id} onDelete={deleteDocument} loading={uploadingType==="other_document"} onUpload={upload}/>
        </div>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#DFE8F4] bg-white shadow-[0_8px_20px_rgba(36,79,145,.06)]">
      <div role="group" aria-label="Activity Status and Remarks" className="flex flex-wrap items-center gap-2 border-b border-[#E6EBF1] p-3">
        <button type="button" aria-expanded={infoTab==="activity"} aria-controls="life-health-case-info-panel" onClick={()=>setInfoTab(current=>current==="activity"?null:"activity")} className={`rounded-xl px-4 py-2.5 text-[11px] font-semibold transition-colors duration-150 ${infoTab==="activity"?"bg-[#17365D] text-white shadow-sm":"text-[#17365D] hover:bg-[#E8EFF9] hover:shadow-sm"}`}>Activity Status</button>
        <button type="button" aria-expanded={infoTab==="remarks"} aria-controls="life-health-case-info-panel" onClick={()=>setInfoTab(current=>current==="remarks"?null:"remarks")} className={`rounded-xl px-4 py-2.5 text-[11px] font-semibold transition-colors duration-150 ${infoTab==="remarks"?"bg-[#17365D] text-white shadow-sm":"text-[#17365D] hover:bg-[#E8EFF9] hover:shadow-sm"}`}>Remarks</button>
      </div>
      {infoTab!==null?<div id="life-health-case-info-panel" role="region" aria-label={infoTab==="activity"?"Activity Status":"Remarks"} className="p-3">
        {infoTab==="activity"?<div className="overflow-hidden rounded-xl border border-[#D9E2F0] bg-[#FBFCFE]">{activities.length?activities.map((activity,index)=><div key={activity.id} className={`grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_260px_190px] md:items-center ${index?"border-t border-[#D9E2F0]":""}`}><div><p className="text-[8px] font-bold uppercase tracking-[.06em] text-[#8090A5]">{index===0?"Latest Action":"Previous Action"}</p><p className="mt-1 text-[12px] font-semibold text-[#17365D]">{activity.action}</p>{activity.changes?.length?<ul className="mt-2 space-y-1">{activity.changes.map((change,i)=><li key={i} className="break-words text-[10px] text-[#52657E]">• {change}</li>)}</ul>:null}</div><p className="text-[9px] text-[#7A8AA0] md:text-right">Details: {activity.action==="Case Created"?"Created By:":"By:"} <span className="font-medium text-[#53657D]">{activity.createdBy}</span></p><p className="text-[9px] text-[#7A8AA0] md:text-right">At: {activityDate(activity.createdAt)}</p></div>):<p className="p-4 text-[10px] text-[#7A8AA0]">Activity not recorded.</p>}</div>:
        <div className="rounded-xl border border-[#D9E2F0] bg-[#FBFCFE] p-4">
          
          <p className="whitespace-pre-wrap break-words text-[11px] leading-5 text-[#17365D]">{savedRemarks.trim()||"No remarks added yet."}</p>
        </div>}
      </div>:null}
    </section>
    {remarkOpen?<div className="fixed inset-0 z-[1100] grid h-[100dvh] w-screen place-items-center bg-[#101828]/60 p-3" role="presentation"><div role="dialog" aria-modal="true" aria-label="Add case remark" className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#E6ECF5] px-5 py-4"><h2 className="text-[14px] font-bold text-[#17365D]">Add Remark</h2><button type="button" disabled={remarkPending} onClick={()=>setRemarkOpen(false)} aria-label="Close remarks" className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#F3F6FB]"><X className="h-4 w-4"/></button></div><div className="space-y-3 p-5"><p className="text-[10px] text-[#667085]">Existing remarks cannot be edited. New remarks are appended to the history.</p><textarea autoFocus aria-label="New remark" value={remarkDraft} onChange={event=>setRemarkDraft(event.target.value)} maxLength={2000} rows={5} placeholder="Enter a new remark…" className="w-full resize-y rounded-xl border border-[#CBD5E1] bg-white px-3 py-2.5 text-[12px] text-[#17203A] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]"/>{remarkError?<p role="alert" className="text-[10px] text-red-600">{remarkError}</p>:null}</div><div className="flex justify-end gap-2 border-t border-[#E6ECF5] bg-[#F8FAFC] p-4"><button type="button" disabled={remarkPending} onClick={()=>setRemarkOpen(false)} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10px] font-semibold">Cancel</button><button type="button" disabled={remarkPending||!remarkDraft.trim()} onClick={addRemark} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white disabled:opacity-50">{remarkPending?"Adding…":"Add Remark"}</button></div></div></div>:null}
    {oversizedLimitMb!==null?<FileSizeExceededPopup maxSizeMb={oversizedLimitMb} onClose={()=>setOversizedLimitMb(null)}/>:null}
    {error?<div role="alert" data-life-health-case-error="true" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">{error}</div>:null}
    {saveSuccess?<div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[11px] font-semibold text-emerald-800">Case details saved successfully.</div>:null}

    <section className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-[#D9E5F4] bg-white px-4 py-3 shadow-[0_8px_24px_rgba(23,54,93,.06)]">
      <Link href="/policies/life-health-cases" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#CAD7E7] bg-white px-4 text-[10px] font-semibold text-[#17365D] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#F2F6FC]"><X className="h-3.5 w-3.5" />Cancel</Link>
      <button type="button" onClick={()=>{setRejectError(null);setRejectOpen(true)}} disabled={saving||converting||uploading||deleting} className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-[10px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-60">Reject</button>
      <button type="button" onClick={saveDetails} disabled={saving||converting||rejectPending} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#BFD3EE] bg-[#EFF5FF] px-4 text-[10px] font-bold text-[#17365D] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#E0EDFF] disabled:opacity-60"><Save className="h-3.5 w-3.5"/>{saving?"Saving…":"Save Case Details"}</button>
      <button type="button" onClick={()=>convert()} disabled={converting||rejectPending} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(100deg,#133766,#2064AD)] px-5 text-[10px] font-bold text-white shadow-[0_8px_18px_rgba(25,78,147,.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(25,78,147,.3)] disabled:opacity-60"><ShieldCheck className="h-4 w-4"/>{converting?"Creating…":"Create Policy & Close Case"}<ArrowRight className="h-3.5 w-3.5"/></button>
    </section>
    {dateApprovalOpen&&issueApprovalRequired?<PolicyDateApprovalDialog issuanceDate={issue.issuanceDate} policyNumber={issue.policyNumber} operation="create" intermediaryCode={caseData.intermediaryCode} verifiedApprovalId={dateApprovalId} onApproved={id=>setIssuedApproval(id?{id,key:issueApprovalKey}:null)} onClose={()=>setDateApprovalOpen(false)} onConfirm={()=>convert(true)} submitting={converting}/>:null}
  </div>
}

function Section({number,title,children,highlight=false,premium=false,contentClassName="md:grid-cols-2 xl:grid-cols-4"}:{number:string;title:string;children:ReactNode;highlight?:boolean;premium?:boolean;contentClassName?:string}){
  return <section className={`overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-[0_14px_32px_rgba(47,89,147,.12)] ${highlight?"border-[#C9D9F5] bg-[#F7FAFF] shadow-[0_10px_34px_rgba(63,99,170,.1)]":premium?"border-[#D7E3F4] bg-white shadow-sm":"border-[#D9E2F0] bg-white shadow-sm"}`}>
    <div className={`relative flex min-h-12 items-center justify-between overflow-hidden border-b px-4 py-2.5 ${highlight?"border-[#C9DAF4] bg-[linear-gradient(110deg,#E1EDFF_0%,#F1F6FF_65%,#DDEBFF_100%)]":premium?"border-[#DFE8F4] bg-[#F4F8FF]":"border-[#D9E2F0] bg-[#FBFCFE]"}`}>
      {highlight?<span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-28 w-56 -rotate-12 rounded-full bg-white/45 blur-2xl"/>:null}
      <div className="relative flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[10px] font-bold text-white shadow-sm ${highlight?"bg-[linear-gradient(135deg,#7755D4,#3F78DA)]":premium?"bg-[#315B9A]":"bg-[#17365D]"}`}>{highlight?<ShieldCheck className="h-5 w-5"/>:number}</span>
        <div><h2 className="text-[13px] font-bold leading-tight text-[#172D53]">{title}</h2>{highlight?<p className="mt-0.5 text-[9px] text-[#59749F]">Update policy status to issued</p>:null}</div>
      </div>
      {highlight?<ShieldCheck className="relative h-7 w-7 text-[#4784DD] opacity-65" aria-hidden="true"/>:null}
    </div>
    <div className={`grid gap-3 p-3 sm:p-4 ${contentClassName}`}>{children}</div>
  </section>;
}
function FieldWrap({title,children,required=false}:{title:string;children:ReactNode;required?:boolean}){return <label><span className={label}>{title}{required?<span className="text-red-500">*</span>:null}</span>{children}</label>}
function MetaLine({left,right}:{left:string;right:string}){if(!left&&!right)return null;return <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 text-[9px] font-semibold text-[#315B6B]"><span>{left}</span>{right?<span>{right}</span>:null}</div>}
function ReadOnlyTextField({title,value}:{title:string;value:string}){return <FieldWrap title={title}><div className={`${readOnlyField} flex items-center`}>{value}</div></FieldWrap>}
function CalculatedDateField({title,value,expected,overridden,onChange,missingHint,required=false}:{title:string;value:string;expected:string;overridden:boolean;mode?:DateCalculationMode;onModeChange?:(mode:DateCalculationMode)=>void;onChange:(value:string)=>void;missingHint?:string;required?:boolean}){
  const differs=Boolean(overridden&&expected&&value&&value!==expected);
  return <FieldWrap title={title} required={required}>
    <DateInput value={value} onChange={onChange}/>
    {differs?<p className="mt-1 text-[8px] leading-3 text-[#9A6700]">Manually changed from the calculated date {formatDate(expected)}. Please verify before issuing.</p>:missingHint?<p className="mt-1 text-[8px] leading-3 text-[#7A869A]">{missingHint}</p>:null}
  </FieldWrap>
}
function DateInput({value,onChange}:{value:string;onChange:(value:string)=>void}){
  const[display,setDisplay]=useState(()=>formatDate(value));
  useEffect(()=>setDisplay(formatDate(value)),[value]);
  const commit=(raw:string)=>{
    const trimmed=raw.trim();
    if(!trimmed){setDisplay("");onChange("");return}
    const match=trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!match)return;
    const[,dd,mm,yyyy]=match;
    const iso=`${yyyy}-${mm}-${dd}`;
    const date=new Date(`${iso}T00:00:00Z`);
    if(Number.isNaN(date.getTime())||date.getUTCFullYear()!==Number(yyyy)||date.getUTCMonth()+1!==Number(mm)||date.getUTCDate()!==Number(dd))return;
    onChange(iso);
    setDisplay(`${dd}/${mm}/${yyyy}`);
  };
  const mask=(raw:string)=>{
    const digits=raw.replace(/\D/g,"").slice(0,8);
    if(digits.length<=2)return digits;
    if(digits.length<=4)return `${digits.slice(0,2)}/${digits.slice(2)}`;
    return `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
  };
  return <div className="relative"><input className={`${field} pr-10`} inputMode="numeric" placeholder="DD/MM/YYYY" value={display} onChange={e=>setDisplay(mask(e.target.value))} onBlur={e=>commit(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")commit((e.target as HTMLInputElement).value)}}/><div className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#667085]"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true"/><input type="date" tabIndex={-1} aria-label="Open date picker" className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={e=>onChange(e.target.value)}/></div></div>
}
function formatDate(value:string){if(!validIso(value))return value;const[y,m,d]=value.split("-");return`${d}/${m}/${y}`}
function UploadAction({label:buttonLabel,type,existing,disabled,loading,deleting,onDelete,onUpload}:{label:string;type:string;existing?:DocumentRow;disabled:boolean;loading:boolean;deleting:boolean;onDelete:(document:DocumentRow)=>void;onUpload:(type:string,file:File|null)=>void}){
  if(!existing)return <label title={buttonLabel} className={`flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl border border-[#CAD7E7] bg-white px-4 text-[9px] font-semibold text-[#24569A] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#9DB9DD] hover:bg-[#F3F8FF] ${disabled?"cursor-wait opacity-70":"cursor-pointer"}`}><Upload className="h-3.5 w-3.5"/><span>{loading?"Uploading…":buttonLabel}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={disabled} className="hidden" onChange={e=>onUpload(type,e.target.files?.[0]??null)}/></label>;
  return <div role="group" aria-label={`${buttonLabel} document actions`} className={`flex h-10 w-full min-w-0 overflow-hidden rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm ${disabled?"opacity-70":""}`}>
    <a href={`/policies/life-health-case-documents/${existing.id}/view`} target="_blank" rel="noreferrer" title={existing.file_name} aria-label={`Open ${existing.file_name}`} className="flex min-w-0 flex-1 items-center gap-2 px-3 text-[10px] font-semibold hover:bg-emerald-100/60"><FileText className="h-3.5 w-3.5 shrink-0"/><span className="truncate">{existing.file_name}</span></a>
    <button type="button" onClick={()=>onDelete(existing)} disabled={disabled} aria-label={`Delete ${existing.file_name}`} title="Delete document" className="grid w-9 shrink-0 place-items-center border-l border-emerald-200 text-red-600 hover:bg-red-50 disabled:opacity-50">{deleting?<LoaderCircle className="h-3.5 w-3.5 animate-spin"/>:<Trash2 className="h-3.5 w-3.5"/>}</button>
    <label title={`Replace ${existing.file_name}`} aria-label={`Replace ${existing.file_name}`} className={`grid w-9 shrink-0 place-items-center border-l border-emerald-200 ${disabled?"cursor-wait opacity-50":"cursor-pointer hover:bg-emerald-100/60"}`}><RefreshCw className="h-3.5 w-3.5"/><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={disabled} className="hidden" onChange={e=>onUpload(type,e.target.files?.[0]??null)}/></label></div>;
}
