"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Eye, HandCoins, Phone, Upload } from "lucide-react";
import { updateIssuedLifeHealthPolicy } from "@/app/policies/life-health-issued-policy-edit-actions";
import { updateIssuedLifeHealthCustomer } from "@/app/policies/life-health-issued-customer-edit-actions";
import { replaceIssuedLifeHealthDocument, type LifeHealthIssuedDocument, type LifeHealthIssuedDocumentType } from "@/app/policies/life-health-issued-policy-document-actions";
import { StandardActivityStatusCard, type StandardActivityItem } from "@/components/standard-activity-status-card";

export type LifeHealthIssuedEditSource = { id:string; type:"POSP"|"MISP"|"SIBL / Partner"; label:string; code:string; mobile:string; rmName:string; rmCode:string };
export type LifeHealthIssuedEditInitial = { policyId:string; caseId:string; businessLine:"Life"|"Health"; sourcingDate:string; sourceId:string; customerName:string; customerPhone:string; customerEmail:string; insurerId:string; productName:string; policyNumber:string; proposalNumber:string; ppt:string; pd:string; paymentFrequency:string; premiumAmount:string; paymentMode:string; remarks:string; startDate:string; endDate:string; finalPremium:string; sumInsured:string };
type CommercialBasis = "NET_PREMIUM_PERCENT"|"FIXED_AMOUNT";
type CommercialModal = "payin"|"payout"|null;
export type LifeHealthCommercialSummary = { payinEntered:boolean; payoutEntered:boolean; payinBasis:CommercialBasis; payinPercent:number; payinFixedAmount:number; insurerSchemeAmount:number; payoutBasis:CommercialBasis; payoutPercent:number; payoutFixedAmount:number; insurerPayin:number; partnerPayout:number; payinAfterTds:number; retention:number };
type Props = { initial:LifeHealthIssuedEditInitial; insurers:Array<{value:string;label:string}>; sources:LifeHealthIssuedEditSource[]; activityItems:StandardActivityItem[]; documents:LifeHealthIssuedDocument[]; commercialAccess:boolean; commercialSummary:LifeHealthCommercialSummary };
const inputClass = "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] font-medium text-[#17203A] outline-none transition placeholder:text-[#98A2B3] hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA] disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:text-[#64748B]";
const labelClass = "mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.055em] text-[#475467]";
const frequencies = ["Monthly","Quarterly","Half Yearly","Annually","One Time"];
const modes = ["Cash","Cheque","NEFT/RTGS","UPI","Credit/Debit Card","Net Banking"];
const years = Array.from({length:50},(_,i)=>`${i+1} Year${i?"s":""}`);
const documentLabels: Array<[LifeHealthIssuedDocumentType,string]> = [["policy_copy","Policy Copy"],["proposal_form","Proposal Form"],["benefit_illustration","Illustration Form"],["premium_receipt","Payment Receipt"],["other_document","Other Form"]];

export function LifeHealthIssuedPolicyEditForm({ initial, insurers, sources, activityItems, documents, commercialAccess, commercialSummary }: Props) {
  const router = useRouter();
  const [form,setForm] = useState(initial);
  const initialSource = sources.find((source)=>source.id === initial.sourceId);
  const [intermediaryType,setIntermediaryType] = useState<LifeHealthIssuedEditSource["type"]>(initialSource?.type || "SIBL / Partner");
  const [documentState,setDocumentState] = useState(documents);
  const [commercialModal,setCommercialModal] = useState<CommercialModal>(null);
  const [commercial,setCommercial] = useState({
    payinBasis:commercialSummary.payinBasis,
    payinPercent:commercialSummary.payinPercent ? String(commercialSummary.payinPercent) : "",
    payinFixedAmount:commercialSummary.payinFixedAmount ? String(commercialSummary.payinFixedAmount) : "",
    insurerSchemeAmount:commercialSummary.insurerSchemeAmount ? String(commercialSummary.insurerSchemeAmount) : "",
    payoutBasis:commercialSummary.payoutBasis,
    payoutPercent:commercialSummary.payoutPercent ? String(commercialSummary.payoutPercent) : "",
    payoutFixedAmount:commercialSummary.payoutFixedAmount ? String(commercialSummary.payoutFixedAmount) : "",
  });
  const [error,setError] = useState<string|null>(null);
  const [pending,startTransition] = useTransition();
  const [documentPending,startDocumentTransition] = useTransition();
  const availableSources = useMemo(()=>sources.filter((source)=>source.type === intermediaryType),[sources,intermediaryType]);
  const selectedSource = sources.find((source)=>source.id === form.sourceId);
  const insurer = insurers.find((item)=>item.value === form.insurerId)?.label ?? "Not selected";
  const required = [form.sourcingDate,form.sourceId,form.customerName,form.customerPhone,form.insurerId,form.productName,form.proposalNumber,form.paymentFrequency,form.premiumAmount,form.paymentMode,form.startDate,form.endDate,form.finalPremium];
  const completion = Math.round(required.filter(Boolean).length/required.length*100);
  const commercialCalculations = useMemo(()=>{
    const premium = Number(form.finalPremium || 0);
    const payinBase = commercial.payinBasis === "FIXED_AMOUNT" ? Number(commercial.payinFixedAmount || 0) : premium * Number(commercial.payinPercent || 0) / 100;
    const totalPayin = payinBase + Number(commercial.insurerSchemeAmount || 0);
    const tds = totalPayin * 0.10;
    const payinAfterTds = totalPayin - tds;
    const totalPayout = commercial.payoutBasis === "FIXED_AMOUNT" ? Number(commercial.payoutFixedAmount || 0) : premium * Number(commercial.payoutPercent || 0) / 100;
    return { payinBase, totalPayin, tds, payinAfterTds, totalPayout, retention:payinAfterTds-totalPayout };
  },[commercial,form.finalPremium]);
  const set = <K extends keyof LifeHealthIssuedEditInitial>(key:K,value:LifeHealthIssuedEditInitial[K])=>setForm((current)=>({...current,[key]:value}));
  useEffect(()=>{
    if(!commercialModal)return;
    const previous=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setCommercialModal(null)};
    window.addEventListener("keydown",close);
    return()=>{document.body.style.overflow=previous;window.removeEventListener("keydown",close)};
  },[commercialModal]);
  const updateCommercial=(key:string,value:string)=>setCommercial((current)=>({...current,[key]:value}));
  const changeCommercialBasis=(side:"payin"|"payout",basis:CommercialBasis)=>{
    if(side==="payin")setCommercial((current)=>({...current,payinBasis:basis,payinPercent:basis==="FIXED_AMOUNT"?"":current.payinPercent,payinFixedAmount:basis==="NET_PREMIUM_PERCENT"?"":current.payinFixedAmount}));
    else setCommercial((current)=>({...current,payoutBasis:basis,payoutPercent:basis==="FIXED_AMOUNT"?"":current.payoutPercent,payoutFixedAmount:basis==="NET_PREMIUM_PERCENT"?"":current.payoutFixedAmount}));
  };

  function changeIntermediaryType(value: LifeHealthIssuedEditSource["type"]) {
    setIntermediaryType(value);
    const first = sources.find((source)=>source.type === value);
    if (first) set("sourceId", first.id);
  }

  function save() {
    const data = new FormData(); Object.entries(form).forEach(([key,value])=>data.set(key,value));
    Object.entries(commercial).forEach(([key,value])=>data.set(key,String(value)));
    setError(null);
    startTransition(async()=>{
      const customerResult = await updateIssuedLifeHealthCustomer(data);
      if (!customerResult.ok) { setError(customerResult.error); return; }
      const result = await updateIssuedLifeHealthPolicy(data);
      if (!result.ok) { setError(result.error); return; }
      router.push(`/policies?success=policy_updated&policy_id=${encodeURIComponent(form.policyId)}`); router.refresh();
    });
  }

  function uploadDocument(type:LifeHealthIssuedDocumentType,file:File|undefined) {
    if (!file) return;
    const data = new FormData(); data.set("policyId",form.policyId); data.set("caseId",form.caseId); data.set("documentType",type); data.set("file",file);
    setError(null);
    startDocumentTransition(async()=>{
      const result = await replaceIssuedLifeHealthDocument(data);
      if (!result.ok) { setError(result.error); return; }
      if (result.document) setDocumentState((current)=>[...current.filter((item)=>item.type!==type),result.document!]);
      router.refresh();
    });
  }

  return <div className="mx-auto max-w-[1480px] pb-8">
    <div className="overflow-hidden rounded-t-xl border border-b-0 border-[#D9E2F0] bg-white shadow-[0_8px_22px_rgba(15,23,42,.05)]"><div className="flex min-h-[58px] items-center bg-[linear-gradient(135deg,#071D49_0%,#123B75_60%,#315B9A_100%)] px-5 text-white"><h1 className="text-[15px] font-semibold">Edit Policy</h1></div></div>
    <nav className="mb-4 flex min-h-[40px] items-center gap-5 rounded-b-xl border border-t-0 border-[#D9E2F0] bg-white px-5 text-[9px] font-semibold text-[#667085]"><span className="border-b-2 border-[#4F46E5] py-3 text-[#3346B8]">01&nbsp; Source</span><span>02&nbsp; Customer / Proposer</span><span>03&nbsp; Policy Product &amp; Case</span><span>04&nbsp; Premium &amp; Payment</span><span>05&nbsp; Issued Policy</span></nav>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]">
      <div className="space-y-4">
        <Section number="01" title="Policy source & ownership">
          <Field label="Policy issuance date" type="date" value={form.sourcingDate} onChange={(v)=>set("sourcingDate",v)} required/>
          <Select label="Policy type" value={form.businessLine} onChange={(v)=>set("businessLine",v as "Life"|"Health")} options={["Life","Health"]}/>
          <div><label className={labelClass}>Intermediary type <Req/></label><select className={inputClass} value={intermediaryType} onChange={(e)=>changeIntermediaryType(e.target.value as LifeHealthIssuedEditSource["type"])}><option>POSP</option><option>MISP</option><option>SIBL / Partner</option></select><div className="flex flex-wrap gap-x-4 gap-y-1"><Meta label="RM" value={selectedSource?.rmName||"—"}/><Meta label="Employee ID" value={selectedSource?.rmCode||"—"}/></div></div>
          <div><label className={labelClass}>Lead source <Req/></label><select className={inputClass} value={form.sourceId} onChange={(e)=>set("sourceId",e.target.value)}>{availableSources.map((s)=><option key={s.id} value={s.id}>{s.label} · {s.code}</option>)}</select><div className="flex gap-3"><Meta label="ID" value={selectedSource?.code||"—"}/>{selectedSource?.mobile?<span className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-[#244C73]"><Phone className="h-3 w-3"/>{selectedSource.mobile}</span>:null}</div></div>
        </Section>
        <Section number="02" title="Customer / proposer"><div><label className={labelClass}>Customer record</label><div className="grid h-10 grid-cols-2 rounded-xl border border-[#D8DEE9] bg-[#F8FAFC] p-1 text-[10px] font-semibold"><span className="grid place-items-center rounded-lg bg-[#17365D] text-white">Existing</span><span className="grid place-items-center text-[#98A2B3]">Linked</span></div></div><Field label="Client / proposer name" value={form.customerName} onChange={(v)=>set("customerName",v)} required/><Field label="Client mobile number" value={form.customerPhone} onChange={(v)=>set("customerPhone",v.replace(/\D/g,"").slice(0,10))} required/><Field label="Email" value={form.customerEmail} onChange={(v)=>set("customerEmail",v)}/></Section>
        <Section number="03" title="Policy product & case details"><div><label className={labelClass}>Insurance company <Req/></label><select className={inputClass} value={form.insurerId} onChange={(e)=>set("insurerId",e.target.value)}>{insurers.map((i)=><option key={i.value} value={i.value}>{i.label}</option>)}</select></div><Field label="Product name" value={form.productName} onChange={(v)=>set("productName",v)}/><Field label="Case / proposal number" value={form.proposalNumber} onChange={(v)=>set("proposalNumber",v.toUpperCase())}/><Select label="PPT · Premium Paying Term" value={form.ppt} onChange={(v)=>set("ppt",v)} options={["Single Pay",...years]} optional/><Select label="PD · Policy Duration / Term" value={form.pd} onChange={(v)=>set("pd",v)} options={years} optional/><Select label="Payment frequency" value={form.paymentFrequency} onChange={(v)=>set("paymentFrequency",v)} options={frequencies}/></Section>
        <Section number="04" title="Premium & payment"><Field label="Case premium amount" value={form.premiumAmount} onChange={(v)=>set("premiumAmount",v.replace(/[^0-9.]/g,""))}/><Select label="Payment mode" value={form.paymentMode} onChange={(v)=>set("paymentMode",v)} options={modes}/><div><label className={labelClass}>Remarks</label><textarea className="h-10 w-full resize-none rounded-xl border border-[#D8DEE9] px-3 py-2.5 text-[11px] outline-none transition hover:border-[#B8C2D1] focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]" value={form.remarks} onChange={(e)=>set("remarks",e.target.value)} rows={1}/></div></Section>
        <Section number="05" title="Issued policy details"><Field label="Policy start date" type="date" value={form.startDate} onChange={(v)=>set("startDate",v)} required/><Field label="Policy end / maturity date" type="date" value={form.endDate} onChange={(v)=>set("endDate",v)} required/><Field label="Final premium" value={form.finalPremium} onChange={(v)=>set("finalPremium",v.replace(/[^0-9.]/g,""))} required/><Field label="Sum assured / insured" value={form.sumInsured} onChange={(v)=>set("sumInsured",v.replace(/[^0-9.]/g,""))}/></Section>
      </div>
      <aside className="self-start rounded-2xl border border-[#D9E2F0] bg-white shadow-sm xl:sticky xl:top-4">
        <div className="flex items-center justify-between border-b border-[#E5ECF5] p-4"><div><p className="text-[8px] font-bold uppercase tracking-[.08em] text-[#7A8799]">Policy status</p><h2 className="mt-1 text-[13px] font-semibold text-[#17365D]">Onboarding summary</h2></div><span className="grid h-12 w-12 place-items-center rounded-full border-[5px] border-[#E7EEF7] text-[10px] font-bold text-[#17365D]">{completion}%</span></div>
        <div className="space-y-4 p-4 text-[10px]"><Summary label="Policy Number" value={form.policyNumber}/><Summary label="Proposal" value={form.proposalNumber}/><Summary label="Insurer" value={insurer}/><Summary label="Product" value={form.productName}/><Summary label="Customer" value={form.customerName}/><div className="border-t pt-3"><p className="text-[9px] font-bold uppercase text-[#667085]">Premium</p><p className="mt-1 text-[18px] font-semibold text-[#17365D]">₹{form.finalPremium||"0"}</p><p className="mt-1 text-[9px] text-[#7A8799]">{form.paymentFrequency||"Frequency pending"} · {form.paymentMode||"Mode pending"}</p></div></div>
        {commercialAccess?<CommercialStatus commercial={commercial} calculations={commercialCalculations} onOpen={setCommercialModal}/>:null}
      </aside>
    </div>
    {error?<div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">{error}</div>:null}
    <div className="mt-4"><StandardActivityStatusCard items={activityItems} emptyText="Activity not recorded"/></div>
    <div className="mt-3 flex flex-col gap-3 border border-[#DDE4EE] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.035)] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{documentLabels.map(([type,label])=>{const doc=documentState.find((item)=>item.type===type);return <div key={type} className="relative">{doc?<div className={`inline-flex h-10 overflow-hidden rounded-xl border border-[#A9DCC2] bg-[#F0FBF5] text-[#168653] ${documentPending?"opacity-70":""}`}><label title={doc.fileName} className={`inline-flex items-center gap-2 px-3 text-[10px] font-semibold transition hover:bg-[#E7F8EF] ${documentPending?"cursor-wait":"cursor-pointer"}`}><Upload className="h-4 w-4"/>{documentPending?"Uploading…":`Replace ${label}`}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={documentPending} onChange={(e)=>uploadDocument(type,e.target.files?.[0])}/></label><a href={doc.viewUrl||undefined} target="_blank" rel="noreferrer" aria-label={`View ${label}`} title={`View ${doc.fileName}`} className={`grid w-9 shrink-0 place-items-center border-l border-[#A9DCC2] transition ${doc.viewUrl?"hover:bg-[#E7F8EF]":"pointer-events-none opacity-50"}`}><Eye className="h-3.5 w-3.5" aria-hidden="true"/></a></div>:<label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#BFD3F5] px-3 text-[10px] font-semibold text-[#1859B7] hover:bg-[#F5F9FF]"><Upload className="h-4 w-4"/>{documentPending?"Uploading…":`Add ${label}`}<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" disabled={documentPending} onChange={(e)=>uploadDocument(type,e.target.files?.[0])}/></label>}</div>})}</div>
      <div className="flex shrink-0 justify-end gap-2"><Link href="/policies" className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[10px] font-semibold">Cancel</Link><button type="button" onClick={save} disabled={pending||documentPending} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white disabled:opacity-60">{pending?"Saving changes…":"Save Policy Changes"}</button></div>
    </div>
    {commercialModal==="payin"?<ProjectedPayinModal commercial={commercial} update={updateCommercial} calculations={commercialCalculations} onBasisChange={(basis)=>changeCommercialBasis("payin",basis)} onClose={()=>setCommercialModal(null)}/>:null}
    {commercialModal==="payout"?<PartnerPayoutModal commercial={commercial} update={updateCommercial} calculations={commercialCalculations} onBasisChange={(basis)=>changeCommercialBasis("payout",basis)} onClose={()=>setCommercialModal(null)}/>:null}
  </div>;
}

function money(value:number){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(Number.isFinite(value)?value:0)}
function CommercialStatus({commercial,calculations,onOpen}:{commercial:{payinBasis:CommercialBasis;payinPercent:string;payinFixedAmount:string;insurerSchemeAmount:string;payoutBasis:CommercialBasis;payoutPercent:string;payoutFixedAmount:string};calculations:{payinBase:number;totalPayin:number;tds:number;payinAfterTds:number;totalPayout:number;retention:number};onOpen:(modal:CommercialModal)=>void}){
  const payinDetail=commercial.payinBasis==="FIXED_AMOUNT"?"Fixed amount":`${commercial.payinPercent||"0"}% of Net Premium`;
  const payoutDetail=commercial.payoutBasis==="FIXED_AMOUNT"?"Fixed amount":`${commercial.payoutPercent||"0"}% of Net Premium`;
  return <div className="mx-4 mb-4 overflow-hidden rounded-xl border border-[#DCE6F2] bg-[#F8FAFD]">
    <div className="flex items-center gap-2 border-b border-[#E3EAF2] px-3 py-2"><HandCoins className="h-3.5 w-3.5 text-[#315B9A]"/><p className="text-[8px] font-bold uppercase tracking-[0.09em] text-[#667085]">Payin–Payout</p></div>
    <CommercialSummaryButton label="Insurer Pay-in" value={calculations.totalPayin} detail={payinDetail} onClick={()=>onOpen("payin")}/>
    <CommercialSummaryButton label="Partner Payout" value={calculations.totalPayout} detail={payoutDetail} onClick={()=>onOpen("payout")}/>
    <div className="flex items-center justify-between gap-3 border-t border-[#E3EAF2] px-3 py-2.5"><div><p className="text-[7.5px] font-bold uppercase tracking-[0.07em] text-[#98A2B3]">Projected retention</p><p className={`mt-0.5 text-[10.5px] font-bold ${calculations.retention<0?"text-red-600":"text-[#344054]"}`}>{money(calculations.retention)}</p></div><span className="text-[7.5px] text-[#98A2B3]">After 10% TDS</span></div>
  </div>
}
function CommercialSummaryButton({label,value,detail,onClick}:{label:string;value:number;detail:string;onClick:()=>void}){return <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-3 border-b border-[#E3EAF2] px-3 py-2.5 text-left transition hover:bg-white"><div><p className="text-[7.5px] font-bold uppercase tracking-[0.07em] text-[#98A2B3]">{label}</p><p className="mt-0.5 text-[10.5px] font-bold text-[#344054]">{money(value)}</p><p className="mt-0.5 text-[7.5px] text-[#98A2B3]">{detail}</p></div><span className="text-[9px] font-bold text-[#315B9A]">Edit</span></button>}
function ProjectedPayinModal({commercial,update,calculations,onBasisChange,onClose}:{commercial:{payinBasis:CommercialBasis;payinPercent:string;payinFixedAmount:string;insurerSchemeAmount:string;payoutBasis:CommercialBasis;payoutPercent:string;payoutFixedAmount:string};update:(key:string,value:string)=>void;calculations:{payinBase:number;totalPayin:number;tds:number;payinAfterTds:number;totalPayout:number;retention:number};onBasisChange:(basis:CommercialBasis)=>void;onClose:()=>void}){return <CommercialModalShell title="Projected Insurer Pay-in" subtitle="Expected insurer income for this policy. This does not create billing or confirm the insurer's actual recognized pay-in." onClose={onClose}><div className="grid gap-3 sm:grid-cols-2"><ModalSelect label="Pay-in basis" value={commercial.payinBasis} onChange={(value)=>onBasisChange(value as CommercialBasis)} options={[["NET_PREMIUM_PERCENT","Net Premium %"],["FIXED_AMOUNT","Fixed Amount"]]}/>{commercial.payinBasis==="NET_PREMIUM_PERCENT"?<ModalField label="Pay-in %" type="number" min="0" max="100" step="0.01" value={commercial.payinPercent} onChange={(value)=>update("payinPercent",commercialNumeric(value))} placeholder="0.00"/>:<ModalField label="Projected pay-in amount" value={commercial.payinFixedAmount} onChange={(value)=>update("payinFixedAmount",commercialNumeric(value))} inputMode="decimal" placeholder="₹ 0.00"/>}<ModalField label="Insurer scheme / incentive" value={commercial.insurerSchemeAmount} onChange={(value)=>update("insurerSchemeAmount",commercialNumeric(value))} inputMode="decimal" placeholder="₹ 0.00"/><CalculatedField label="Base projected pay-in" value={moneyPrecise(calculations.payinBase)}/><CalculatedField label="Projected total pay-in" value={moneyPrecise(calculations.totalPayin)}/><CalculatedField label="TDS @ 10%" value={moneyPrecise(calculations.tds)}/><CalculatedField label="Pay-in after TDS" value={moneyPrecise(calculations.payinAfterTds)}/></div><p className="mt-4 rounded-xl border border-[#DCE6F2] bg-[#F8FAFD] px-3 py-2.5 text-[9px] leading-4 text-[#667085]">Blank means projected pay-in has not been entered. Entering 0 explicitly is valid and is preserved as an entered commercial value.</p></CommercialModalShell>}
function PartnerPayoutModal({commercial,update,calculations,onBasisChange,onClose}:{commercial:{payinBasis:CommercialBasis;payinPercent:string;payinFixedAmount:string;insurerSchemeAmount:string;payoutBasis:CommercialBasis;payoutPercent:string;payoutFixedAmount:string};update:(key:string,value:string)=>void;calculations:{payinBase:number;totalPayin:number;tds:number;payinAfterTds:number;totalPayout:number;retention:number};onBasisChange:(basis:CommercialBasis)=>void;onClose:()=>void}){return <CommercialModalShell title="Partner Payout" subtitle="Agreed payout for the Lead Source selected in Section 01. Payment approval, voucher and settlement remain in the partner-payment workflow." onClose={onClose}><div className="grid gap-3 sm:grid-cols-2"><ModalSelect label="Payout basis" value={commercial.payoutBasis} onChange={(value)=>onBasisChange(value as CommercialBasis)} options={[["NET_PREMIUM_PERCENT","Net Premium %"],["FIXED_AMOUNT","Fixed Amount"]]}/>{commercial.payoutBasis==="NET_PREMIUM_PERCENT"?<ModalField label="Payout %" type="number" min="0" max="100" step="0.01" value={commercial.payoutPercent} onChange={(value)=>update("payoutPercent",commercialNumeric(value))} placeholder="0.00"/>:<ModalField label="Agreed payout amount" value={commercial.payoutFixedAmount} onChange={(value)=>update("payoutFixedAmount",commercialNumeric(value))} inputMode="decimal" placeholder="₹ 0.00"/>}<CalculatedField label="Total agreed payout" value={moneyPrecise(calculations.totalPayout)}/><CalculatedField label="Projected retention" value={moneyPrecise(calculations.retention)} negative={calculations.retention<0}/></div><p className="mt-4 rounded-xl border border-[#E4DFF2] bg-[#FAF8FF] px-3 py-2.5 text-[9px] leading-4 text-[#667085]">The payout is tagged automatically to the intermediary type and code selected in Section 01. Negative retention is allowed as a commercial exception and is highlighted for finance review.</p></CommercialModalShell>}
function CommercialModalShell({title,subtitle,onClose,children}:{title:string;subtitle:string;onClose:()=>void;children:ReactNode}){if(typeof document==="undefined")return null;return createPortal(<div className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center overflow-hidden bg-[#071D49]/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label={title}><div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_24px_80px_rgba(7,29,73,.4)]"><div className="flex shrink-0 items-start justify-between border-b border-[#E6EBF2] bg-[linear-gradient(135deg,#F8FAFD,#EEF4FB)] px-4 py-3.5 sm:px-5"><div className="min-w-0 pr-3"><p className="text-[14px] font-bold text-[#102A4C]">{title}</p><p className="mt-1 text-[9.5px] leading-4 text-[#667085]">{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#D8DEE9] bg-white text-[17px] text-[#475467] transition hover:bg-[#F8FAFC]">×</button></div><div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">{children}</div><div className="shrink-0 border-t border-[#E6EBF2] bg-[#F8FAFC] px-4 py-3 sm:px-5"><div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-xl bg-[#17365D] px-5 py-2.5 text-[10px] font-bold text-white">Save & Close</button></div></div></div></div>,document.body)}
function ModalField({label,value,onChange,type="text",inputMode,placeholder,min,max,step}:{label:string;value:string;onChange:(value:string)=>void;type?:string;inputMode?:"decimal"|"numeric";placeholder?:string;min?:string;max?:string;step?:string}){return <div><label className={labelClass}>{label}</label><input className={inputClass} type={type} inputMode={inputMode} min={min} max={max} step={step} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}/></div>}
function ModalSelect({label,value,onChange,options}:{label:string;value:string;onChange:(value:string)=>void;options:Array<[string,string]>}){return <div><label className={labelClass}>{label}</label><select className={inputClass} value={value} onChange={(e)=>onChange(e.target.value)}>{options.map(([optionValue,optionLabel])=><option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>}
function CalculatedField({label,value,negative=false}:{label:string;value:string;negative?:boolean}){return <div><label className={labelClass}>{label}</label><div className={`grid h-10 w-full items-center rounded-xl border border-[#D8DEE9] bg-[#F8FAFC] px-3 text-[11px] font-semibold ${negative?"text-red-600":"text-[#17203A]"}`}>{value}</div></div>}
function commercialNumeric(value:string){const cleaned=value.replace(/[^0-9.]/g,"");const [whole,...rest]=cleaned.split(".");return rest.length?`${whole}.${rest.join("").slice(0,2)}`:whole}
function moneyPrecise(value:number){return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(Number.isFinite(value)?value:0)}
function Section({number,title,children}:{number:string;title:string;children:React.ReactNode}){return <section className="overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm"><div className="flex items-center gap-3 border-b border-[#E5ECF5] px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#17365D] text-[10px] font-bold text-white">{number}</span><h2 className="text-[12px] font-semibold text-[#17365D]">{title}</h2></div><div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">{children}</div></section>}
function Field({label,value,onChange,type="text",disabled=false,required=false}:{label:string;value:string;onChange?:(v:string)=>void;type?:string;disabled?:boolean;required?:boolean}){return <div><label className={labelClass}>{label}{required?<Req/>:null}</label><input type={type} className={inputClass} value={value} onChange={(e)=>onChange?.(e.target.value)} disabled={disabled}/></div>}
function Select({label,value,onChange,options,optional=false}:{label:string;value:string;onChange:(v:string)=>void;options:string[];optional?:boolean}){return <div><label className={labelClass}>{label}{optional?null:<Req/>}</label><select className={inputClass} value={value} onChange={(e)=>onChange(e.target.value)}>{optional?<option value="">Select term</option>:null}{options.map((o)=><option key={o} value={o}>{o}</option>)}</select></div>}
function Meta({label,value}:{label:string;value:string}){return <span className="mt-1.5 text-[10px] font-semibold text-[#244C73]"><span className="mr-1 text-[8px] uppercase text-[#7A8799]">{label}</span>{value}</span>}
function Summary({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-3 border-b border-[#EEF2F7] pb-2"><span className="text-[#7A8799]">{label}</span><span className="max-w-[190px] text-right font-semibold text-[#17365D]">{value||"Not entered"}</span></div>}
function Req(){return <span className="text-red-500">*</span>}