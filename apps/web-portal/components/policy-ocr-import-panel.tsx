"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Eraser, FileUp } from "lucide-react";
import { extractPolicyDocument, type PolicyOcrField } from "@/app/policies/policy-ocr-actions";

export const SECTION_02_OCR_FIELDS = [
  "vehicle_registration_status",
  "vehicle_registration_number",
  "vehicle_class",
  "vehicle_make",
  "vehicle_model",
  "vehicle_fuel_type",
  "vehicle_manufacturing_year",
  "vehicle_capacity",
  "vehicle_chassis_number",
  "vehicle_engine_number",
  "vehicle_rto_name",
  "vehicle_rto_state",
] as const;

export const SECTION_03_OCR_FIELDS = [
  "policy_product",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_premium",
  "policy_number",
  "insurer_name",
  "policy_start_date",
  "policy_end_date",
] as const;

const SECTION_02_FIELDS = new Set<string>(SECTION_02_OCR_FIELDS);
const SECTION_03_FIELDS = new Set<string>(SECTION_03_OCR_FIELDS);
const VERIFICATION_FIELDS = new Set(["cpa_opted", "total_premium", "tax_amount", "gross_premium"]);
const APPLY_FIELDS = new Set([...SECTION_02_FIELDS, ...SECTION_03_FIELDS]);
const APPLY_ORDER = [
  "vehicle_registration_status",
  "vehicle_registration_number",
  "vehicle_class",
  "vehicle_make",
  "vehicle_model",
  "vehicle_fuel_type",
  "vehicle_manufacturing_year",
  "vehicle_rto_state",
  "vehicle_rto_name",
  "vehicle_chassis_number",
  "vehicle_engine_number",
  "vehicle_capacity",
  "policy_product",
  "policy_number",
  "insurer_name",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_premium",
  "policy_start_date",
  "policy_end_date",
];
const POLICY_DRAFT_KEY = "insureit:policy-onboarding:draft:v1";

export type PolicyOcrImportContext = {
  mode: "create" | "edit";
  registrationMode: "registered" | "unregistered";
  currentValues: Partial<Record<string, string>>;
  protectedKeys?: string[];
};

export type PolicyOcrApplyOutcome = {
  applied: number;
  skipped: string[];
};

export type PolicyOcrImportPanelProps = {
  variant?: "header" | "icon";
  context: PolicyOcrImportContext;
  onApply: (fields: PolicyOcrField[]) => PolicyOcrApplyOutcome | Promise<PolicyOcrApplyOutcome>;
};

type ReviewState = "ready" | "review" | "conflict" | "protected";
type ReviewedField = PolicyOcrField & { currentValue: string; reviewState: ReviewState };

export function PolicyOcrImportPanel({ variant = "header", context, onApply }: PolicyOcrImportPanelProps) {
  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [fields, setFields] = useState<PolicyOcrField[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [documentName, setDocumentName] = useState("");
  const [parserInfo, setParserInfo] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const protectedKeys = useMemo(() => new Set(context.protectedKeys ?? []), [context.protectedKeys]);
  const reviewedFields = useMemo(() => fields
    .filter((field) => APPLY_FIELDS.has(field.key))
    .map((field): ReviewedField => {
      const currentValue = context.currentValues[field.key] ?? "";
      const protectedField = (context.mode === "edit" && SECTION_02_FIELDS.has(field.key)) || protectedKeys.has(field.key);
      const confidence = field.confidence ?? 0;
      const same = valuesEquivalent(field, currentValue);
      const conflict = Boolean(currentValue.trim()) && !same;
      return {
        ...field,
        currentValue,
        reviewState: protectedField ? "protected" : conflict ? "conflict" : confidence >= .9 ? "ready" : "review",
      };
    }), [fields, context.currentValues, context.mode, protectedKeys]);

  const section02 = reviewedFields.filter((field) => SECTION_02_FIELDS.has(field.key));
  const section03 = reviewedFields.filter((field) => SECTION_03_FIELDS.has(field.key));
  const verificationFields = fields.filter((field) => VERIFICATION_FIELDS.has(field.key));
  const selectedCount = selected.size;
  const hasResult = reviewedFields.length > 0 || verificationFields.length > 0;
  const reviewCount = reviewedFields.filter((field) => field.reviewState !== "ready").length;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, pending]);

  function resetReview() {
    setFields([]);
    setSelected(new Set());
    setWarnings([]);
    setParserInfo(null);
    setError(null);
  }

  function closeModal() {
    if (pending) return;
    setOpen(false);
    resetReview();
    setDocumentName("");
    formRef.current?.reset();
  }

  function clearPolicyDraft() {
    try { sessionStorage.removeItem(POLICY_DRAFT_KEY); } catch {}
    setConfirmClear(false);
    window.location.reload();
  }

  function submit(formData: FormData) {
    setError(null);
    setFields([]);
    setSelected(new Set());
    setWarnings([]);
    setParserInfo(null);
    const file = formData.get("policy_document");
    if (file instanceof File) setDocumentName(file.name);

    startTransition(async () => {
      const result = await extractPolicyDocument(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFields(result.fields);
      setParserInfo(`${friendlyParserName(result.parserId)} · ${friendlyMethod(result.extractionMethod)}`);
      setWarnings(result.warnings);
      const safeKeys = result.fields
        .filter((field) => APPLY_FIELDS.has(field.key) && (field.confidence ?? 0) >= .9)
        .filter((field) => {
          if ((context.mode === "edit" && SECTION_02_FIELDS.has(field.key)) || protectedKeys.has(field.key)) return false;
          const current = context.currentValues[field.key] ?? "";
          return !current.trim() || valuesEquivalent(field, current);
        })
        .map((field) => field.key);
      setSelected(new Set(safeKeys));
    });
  }

  function toggle(key: string) {
    const item = reviewedFields.find((field) => field.key === key);
    if (!item || item.reviewState === "protected") return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectSection(section: Set<string>) {
    setSelected((current) => {
      const next = new Set(current);
      reviewedFields
        .filter((field) => section.has(field.key) && field.reviewState !== "protected")
        .forEach((field) => next.add(field.key));
      return next;
    });
  }

  function clearSection(section: Set<string>) {
    setSelected((current) => new Set(Array.from(current).filter((key) => !section.has(key))));
  }

  async function applySelected() {
    const selectedByKey = new Map(fields
      .filter((field) => selected.has(field.key) && APPLY_FIELDS.has(field.key))
      .map((field) => [field.key, field]));
    const chosen = APPLY_ORDER.map((key) => selectedByKey.get(key)).filter((field): field is PolicyOcrField => Boolean(field));
    if (!chosen.length) return;

    const outcome = await onApply(chosen);
    if (!outcome.applied) {
      setError("The selected details could not be applied. Protected or unmatched values were left unchanged.");
      return;
    }

    setOpen(false);
    resetReview();
    setDocumentName("");
    formRef.current?.reset();
    window.dispatchEvent(new CustomEvent("insureit:policy-import-result", { detail: outcome }));
    requestAnimationFrame(() => {
      const target = document.getElementById("policy-section-2") ?? document.getElementById("policy-section-3");
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const modal = open && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-[#071A38]/70 p-3 backdrop-blur-[3px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="policy-import-title">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[1120px] flex-col overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(4,22,49,.38)] sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-start justify-between border-b border-[#E5EAF1] px-5 py-5 sm:px-7">
          <div className="pr-4">
            <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#55708F]"><span className="grid h-6 w-9 place-items-center rounded-lg bg-[#EAF1FB] text-[#173B67]">02–03</span>Policy onboarding</div>
            <h2 id="policy-import-title" className="text-[18px] font-bold tracking-[-.01em] text-[#102A4C]">Import policy details</h2>
            <p className="mt-1.5 max-w-3xl text-[10px] leading-5 text-[#667085]">Read vehicle and policy information from one policy copy. Nothing is booked or saved until you review the extracted values and complete policy onboarding.</p>
          </div>
          <button type="button" onClick={closeModal} disabled={pending} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#D8E0EA] bg-white text-[20px] font-light text-[#526277] transition hover:bg-[#F4F7FA] disabled:opacity-50" aria-label="Close">×</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
          <form ref={formRef} action={submit} className="border-b border-[#E7ECF2] pb-6">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="block"><span className="mb-2 block text-[9px] font-bold uppercase tracking-[.08em] text-[#475467]">Policy document</span><input name="policy_document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required disabled={pending} className="block h-[48px] w-full rounded-xl border border-[#D7DFE9] bg-white text-[10px] text-[#536174] shadow-sm outline-none transition file:mr-4 file:h-full file:border-0 file:border-r file:border-[#D7DFE9] file:bg-[#F2F6FB] file:px-5 file:text-[10px] file:font-semibold file:text-[#173B67] hover:border-[#AEBAC9] focus:border-[#315B9A] disabled:opacity-60"/></label>
              <button disabled={pending} className="h-[48px] rounded-xl bg-[#173B67] px-7 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#102E52] disabled:cursor-wait disabled:opacity-60">{pending ? "Reading document…" : hasResult ? "Read another document" : "Read document"}</button>
            </div>
            <p className="mt-2.5 text-[9px] leading-4 text-[#7C899A]">Insured name and phone are never proposed. Existing values that disagree with OCR are marked as conflicts. RC-verified and edit-mode vehicle fields are protected from policy-copy overwrite.</p>
          </form>

          {pending ? <div className="flex items-center gap-3 border-b border-[#E7ECF2] py-6 text-[#42566F]"><span className="h-5 w-5 animate-spin rounded-full border-2 border-[#BFD0E5] border-t-[#173B67]"/><div><p className="text-[10px] font-semibold">Reading policy schedule</p><p className="mt-0.5 text-[9px] text-[#7A8798]">Vehicle, policy and premium sections are processed together.</p></div></div> : null}
          {error ? <div className="mt-5 rounded-xl border border-[#F2C7C7] bg-[#FFF6F6] px-4 py-3 text-[10px] font-medium text-[#B42318]">{error}</div> : null}
          {warnings.length ? <div className="mt-5 rounded-xl border border-[#F0D9A8] bg-[#FFFAEE] px-4 py-3">{warnings.map((warning) => <p key={warning} className="text-[9px] leading-4 text-[#7A5514]">{warning}</p>)}</div> : null}

          {hasResult ? <section className="mt-6 space-y-5">
            <div className="flex flex-col gap-3 rounded-xl border border-[#DCE4EE] bg-[#F8FAFD] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-[12px] font-bold text-[#152D4F]">Review extracted details</h3><p className="mt-1 text-[9px] text-[#728095]">{documentName || "Policy document"}{parserInfo ? ` · ${parserInfo}` : ""}</p></div><div className="flex flex-wrap gap-2"><SummaryChip label="Section 02" value={`${section02.length} found`}/><SummaryChip label="Section 03" value={`${section03.length} found`}/><SummaryChip label="Needs review" value={String(reviewCount)} tone={reviewCount ? "warn" : "ok"}/></div></div>
            <ReviewGroup number="02" title="Vehicle identification" fields={section02} selected={selected} onToggle={toggle} onSelectAll={()=>selectSection(SECTION_02_FIELDS)} onClear={()=>clearSection(SECTION_02_FIELDS)}/>
            <ReviewGroup number="03" title="Policy, premium & validity" fields={section03} selected={selected} onToggle={toggle} onSelectAll={()=>selectSection(SECTION_03_FIELDS)} onClear={()=>clearSection(SECTION_03_FIELDS)}/>
            {verificationFields.length ? <div className="rounded-xl border border-[#DFE5EC] bg-[#FAFBFC] p-4"><div className="mb-3 flex items-center justify-between"><h4 className="text-[10px] font-bold text-[#334A67]">Policy totals & CPA evidence</h4><span className="text-[8px] text-[#7B8797]">Comparison only</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{verificationFields.map((field)=><div key={field.key} className="rounded-lg border border-[#E2E7EE] bg-white px-3 py-2.5"><span className="block text-[8px] font-medium text-[#69778A]">{field.label}</span><span className="mt-1 block text-[10px] font-bold text-[#213955]">{formatFieldValue(field)}</span></div>)}</div><p className="mt-3 text-[8.5px] leading-4 text-[#7A8798]">Net, GST and Gross remain verification-only. Owner-driver CPA evidence is shown separately because paid-driver/workmen liability additions must not automatically mean CPA opted = Yes.</p></div> : null}
          </section> : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-[#E2E8F0] bg-[#FAFBFC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p className="text-[9px] text-[#69778A]">{hasResult ? `${selectedCount} field${selectedCount===1?"":"s"} selected · conflicts stay unchecked by default` : "Review all values before applying them to the form."}</p><div className="flex justify-end gap-2"><button type="button" onClick={closeModal} disabled={pending} className="h-10 rounded-xl border border-[#C9D3DF] bg-white px-5 text-[9.5px] font-semibold text-[#2B405B] transition hover:bg-[#F4F7FA] disabled:opacity-50">Cancel</button><button type="button" onClick={applySelected} disabled={!selectedCount || pending} className="h-10 rounded-xl bg-[#315B9A] px-6 text-[9.5px] font-bold text-white shadow-sm transition hover:bg-[#264C83] disabled:cursor-not-allowed disabled:opacity-40">Apply selected details</button></div></footer>
      </div>
    </div>, document.body) : null;

  const clearModal = confirmClear && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[10000] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/65 p-4 backdrop-blur-[3px]" role="alertdialog" aria-modal="true" aria-labelledby="clear-policy-form-title">
      <div className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_26px_80px_rgba(7,29,73,.42)]">
        <div className="px-6 pb-5 pt-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#FFF4E2] text-[#C56B12] ring-8 ring-[#FFF9F0]"><Eraser className="h-5 w-5" strokeWidth={2}/></div>
          <h2 id="clear-policy-form-title" className="mt-4 text-[15px] font-bold text-[#102A4C]">Clear policy form?</h2>
          <p className="mx-auto mt-2 max-w-sm text-[10.5px] leading-5 text-[#667085]">This removes all details entered in the current policy onboarding draft and restores the form to its default state.</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E6EBF2] bg-[#F8FAFC] px-5 py-3.5"><button type="button" onClick={()=>setConfirmClear(false)} className="h-10 rounded-xl border border-[#D1D9E4] bg-white px-4 text-[9.5px] font-semibold text-[#475467] transition hover:bg-[#F3F6FA]">Cancel</button><button type="button" onClick={clearPolicyDraft} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#B85C16] px-4 text-[9.5px] font-bold text-white shadow-sm transition hover:bg-[#9F4E12]"><Eraser className="h-4 w-4" strokeWidth={2}/><span>Clear form</span></button></div>
      </div>
    </div>, document.body) : null;

  return <>{variant === "icon" ? <button type="button" onClick={()=>setOpen(true)} aria-label="Import Section 02 and 03 from policy copy" title="Import vehicle + policy details" className="grid h-8 w-8 place-items-center rounded-lg border border-[#D7E0EA] bg-white text-[#315B9A] shadow-sm transition hover:border-[#B8C8DC] hover:bg-[#F3F7FC] focus:outline-none focus:ring-2 focus:ring-[#DCE8FA]"><FileUp className="h-4 w-4" strokeWidth={1.9}/></button> : <div className="flex flex-wrap items-center justify-end gap-2"><button type="button" onClick={()=>setOpen(true)} className="group inline-flex h-10 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3.5 text-[10px] font-bold text-white shadow-sm transition hover:border-white/45 hover:bg-white/18 focus:outline-none focus:ring-2 focus:ring-white/25"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#0F466D]/55 text-[#7CE7E0] ring-1 ring-white/10 transition group-hover:bg-[#12547F]"><FileUp className="h-4 w-4" strokeWidth={2}/></span><span>Import Policy Details</span></button>{context.mode === "create" ? <button type="button" onClick={()=>setConfirmClear(true)} className="group inline-flex h-10 items-center gap-2 rounded-xl border border-white/22 bg-[#071D49]/24 px-3.5 text-[10px] font-semibold text-white/90 shadow-sm transition hover:border-[#FFC66D]/60 hover:bg-[#5B3514]/22 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#FFC66D]/20"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#5A3A17]/45 text-[#FFC66D] ring-1 ring-[#FFC66D]/20 transition group-hover:bg-[#6A4319]/60"><Eraser className="h-4 w-4" strokeWidth={2}/></span><span>Clear Form</span></button> : null}</div>}{modal}{clearModal}</>;
}

function ReviewGroup({number,title,fields,selected,onToggle,onSelectAll,onClear}:{number:string;title:string;fields:ReviewedField[];selected:Set<string>;onToggle:(key:string)=>void;onSelectAll:()=>void;onClear:()=>void}){
  return <div className="overflow-hidden rounded-xl border border-[#DCE3EB]"><div className="flex items-center justify-between border-b border-[#DCE3EB] bg-[#F5F7FA] px-4 py-3"><div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-[#173B67] text-[8px] font-bold text-white">{number}</span><h4 className="text-[10px] font-bold text-[#2B405B]">{title}</h4></div><div className="flex gap-2"><button type="button" onClick={onSelectAll} className="text-[8.5px] font-semibold text-[#315B9A]">Select all</button><button type="button" onClick={onClear} className="text-[8.5px] font-semibold text-[#667085]">Clear</button></div></div>{fields.length ? <div><div className="hidden grid-cols-[40px_1fr_1fr_1fr_100px] border-b border-[#E5EAF0] bg-[#FBFCFD] px-3 py-2 text-[8px] font-bold uppercase tracking-[.06em] text-[#768397] sm:grid"><span/><span>Field</span><span>Current</span><span>Extracted</span><span>Status</span></div><div className="divide-y divide-[#E5EAF0] bg-white">{fields.map((field)=><ReviewRow key={field.key} field={field} checked={selected.has(field.key)} onToggle={()=>onToggle(field.key)}/>)}</div></div> : <p className="px-4 py-5 text-[9px] text-[#7A8798]">No supported fields were extracted for this section.</p>}</div>;
}

function ReviewRow({field,checked,onToggle}:{field:ReviewedField;checked:boolean;onToggle:()=>void}){
  const status = field.reviewState === "ready" ? ["Ready","bg-[#EAF7F0] text-[#18794E]"] : field.reviewState === "conflict" ? ["Conflict","bg-[#FFF0EE] text-[#B42318]"] : field.reviewState === "protected" ? ["Protected","bg-[#EEF1F5] text-[#667085]"] : ["Review","bg-[#FFF4DF] text-[#9A6412]"];
  return <label className={`grid gap-2 px-3 py-3.5 transition sm:grid-cols-[40px_1fr_1fr_1fr_100px] sm:items-center ${field.reviewState==="protected"?"cursor-not-allowed bg-[#FAFBFC]":"cursor-pointer hover:bg-[#FAFBFC]"}`}><span><input type="checkbox" checked={checked} onChange={onToggle} disabled={field.reviewState==="protected"} className="h-4 w-4 rounded border-[#B9C4D2] text-[#315B9A] focus:ring-[#AFC5E2] disabled:opacity-40"/></span><span><span className="block text-[8px] font-bold uppercase tracking-[.055em] text-[#69778A] sm:hidden">Field</span><span className="text-[10px] font-semibold text-[#243A57]">{field.label}</span>{field.page ? <span className="ml-1 text-[8px] text-[#8A96A6]">p.{field.page}</span> : null}</span><span className="min-w-0"><span className="block text-[8px] font-bold uppercase tracking-[.055em] text-[#69778A] sm:hidden">Current</span><span className="block break-words text-[9.5px] text-[#667085]">{field.currentValue || "—"}</span></span><span className="min-w-0"><span className="block text-[8px] font-bold uppercase tracking-[.055em] text-[#69778A] sm:hidden">Extracted</span><span className="block break-words text-[10px] font-semibold text-[#121F33]">{formatFieldValue(field)}</span></span><span><span className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-bold ${status[1]}`}>{status[0]}</span></span></label>;
}

function SummaryChip({label,value,tone="neutral"}:{label:string;value:string;tone?:"neutral"|"warn"|"ok"}){const style=tone==="warn"?"border-[#F0D9A8] bg-[#FFF8E8] text-[#8A5A10]":tone==="ok"?"border-[#CFE8DA] bg-[#F1FAF5] text-[#18794E]":"border-[#D6E0EB] bg-white text-[#53657D]";return <span className={`rounded-full border px-2.5 py-1 text-[8px] font-semibold ${style}`}>{label} · {value}</span>;}
function friendlyParserName(parserId:string){if(parserId.startsWith("digit_"))return"Digit commercial vehicle format";if(parserId.startsWith("iffco_tokio_"))return"IFFCO-Tokio commercial vehicle format";if(parserId.startsWith("new_india_"))return"New India motor format";return"Standard motor policy format";}
function friendlyMethod(method:string){return method==="native_pdf_text"?"digital policy":"Google Document AI";}
function formatFieldValue(field:PolicyOcrField){if(["idv","od_premium","tp_premium","cpa_premium","total_premium","tax_amount","gross_premium"].includes(field.key)){const number=Number(field.value.replace(/,/g,""));if(Number.isFinite(number))return new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(number);}return field.value;}
function normalizeText(value:string){return value.toLowerCase().replace(/\b(?:the|co|company|limited|ltd|general|insurance)\b/g," ").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
function valuesEquivalent(field:PolicyOcrField,current:string){if(!current.trim())return false;if(field.key==="vehicle_registration_status")return /pending|unregistered|new vehicle/i.test(field.value)?/unregistered/i.test(current):/registered/i.test(current)&&!/unregistered/i.test(current);if(["idv","od_premium","tp_premium","cpa_premium"].includes(field.key)){const a=Number(field.value.replace(/,/g,"")),b=Number(current.replace(/[^0-9.]/g,""));return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=2;}if(field.key==="policy_start_date"||field.key==="policy_end_date")return toIsoDate(field.value)===toIsoDate(current);const a=normalizeText(field.value),b=normalizeText(current);return Boolean(a&&b&&(a===b||a.includes(b)||b.includes(a)));}
function toIsoDate(value:string){if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value;const months:Record<string,string>={JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12"};const match=value.toUpperCase().match(/(\d{1,2})[-/]([A-Z]{3}|\d{1,2})[-/](\d{4})/);if(!match)return"";const month=months[match[2]]??match[2].padStart(2,"0");return`${match[3]}-${month}-${match[1].padStart(2,"0")}`;}
