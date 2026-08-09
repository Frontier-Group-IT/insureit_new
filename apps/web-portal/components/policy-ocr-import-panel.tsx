"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { extractPolicyDocument, type PolicyOcrField } from "@/app/policies/policy-ocr-actions";

const APPLY_FIELDS = new Set([
  "policy_product",
  "idv",
  "od_premium",
  "tp_premium",
  "cpa_premium",
  "policy_number",
  "insurer_name",
  "policy_start_date",
  "policy_end_date",
]);

const VERIFICATION_FIELDS = new Set(["total_premium", "tax_amount", "gross_premium"]);

const FIELD_TARGETS: Record<string, string[]> = {
  policy_product: ["policy product"],
  idv: ["idv / sum insured", "idv"],
  od_premium: ["od premium"],
  tp_premium: ["third party premium", "tp premium"],
  cpa_premium: ["cpa amount", "cpa premium"],
  policy_number: ["policy number"],
  insurer_name: ["insurance company", "insurer"],
  policy_start_date: ["valid from"],
  policy_end_date: ["valid upto", "valid up to"],
};

const PRODUCT_ALIASES: Record<string, string[]> = {
  Package: ["package", "package policy", "comprehensive", "comprehensive policy"],
  "Third Party": ["third party", "third party policy", "liability only", "act only"],
  SAOD: ["saod", "standalone od", "stand alone od", "standalone own damage", "stand alone own damage"],
  Bundled: ["bundled", "bundled policy"],
  "Long Term Package": ["long term package", "multi year package"],
  "Long Term Third Party": ["long term third party", "long term liability", "multi year third party"],
};

const INSURER_ALIASES: Record<string, string[]> = {
  digit: ["digit", "go digit"],
  iffco: ["iffco tokio", "iffco-tokio"],
  newindia: ["new india assurance", "the new india assurance"],
};

export function PolicyOcrImportPanel({ variant = "header" }: { variant?: "header" | "icon" }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<PolicyOcrField[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [documentName, setDocumentName] = useState("");
  const [parserInfo, setParserInfo] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const editableFields = useMemo(() => fields.filter((field) => APPLY_FIELDS.has(field.key)), [fields]);
  const verificationFields = useMemo(() => fields.filter((field) => VERIFICATION_FIELDS.has(field.key)), [fields]);
  const selectedCount = selected.size;
  const hasResult = editableFields.length > 0 || verificationFields.length > 0;

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
      setSelected(new Set(result.fields
        .filter((field) => APPLY_FIELDS.has(field.key) && (field.confidence ?? 0) >= .8)
        .map((field) => field.key)));
    });
  }

  function toggle(key: string) {
    if (!APPLY_FIELDS.has(key)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(editableFields.map((field) => field.key)));
  }

  function applySelected() {
    const chosen = fields.filter((field) => selected.has(field.key) && APPLY_FIELDS.has(field.key));
    let applied = 0;
    const skipped: string[] = [];

    for (const field of chosen) {
      const control = findControl(FIELD_TARGETS[field.key] ?? []);
      if (!control) {
        skipped.push(field.label);
        continue;
      }
      const value = valueForControl(field, control);
      if (!value || !setNativeValue(control, value)) {
        skipped.push(field.label);
        continue;
      }
      applied += 1;
    }

    if (!applied) {
      setError("The selected details could not be applied. Please review the form fields and try again.");
      return;
    }

    setOpen(false);
    resetReview();
    setDocumentName("");
    formRef.current?.reset();

    requestAnimationFrame(() => {
      const section = findControl(["policy product"])?.closest("section") ?? findControl(["policy product"])?.parentElement;
      section?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    if (skipped.length) {
      window.dispatchEvent(new CustomEvent("insureit:policy-import-partial", { detail: { applied, skipped } }));
    }
  }

  const modal = open && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-[#071A38]/70 p-3 backdrop-blur-[3px] sm:p-6" role="dialog" aria-modal="true" aria-labelledby="policy-import-title">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[980px] flex-col overflow-hidden rounded-[22px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(4,22,49,.38)] sm:max-h-[calc(100dvh-3rem)]">
        <header className="flex shrink-0 items-start justify-between border-b border-[#E5EAF1] px-5 py-5 sm:px-7">
          <div className="pr-4">
            <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#55708F]">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#EAF1FB] text-[#173B67]">03</span>
              Policy onboarding
            </div>
            <h2 id="policy-import-title" className="text-[18px] font-bold tracking-[-.01em] text-[#102A4C]">Import policy and premium details</h2>
            <p className="mt-1.5 max-w-2xl text-[10px] leading-5 text-[#667085]">Upload the policy schedule, confirm the extracted values, and copy the selected details into Policy product, premium &amp; validity.</p>
          </div>
          <button type="button" onClick={closeModal} disabled={pending} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#D8E0EA] bg-white text-[20px] font-light text-[#526277] transition hover:bg-[#F4F7FA] disabled:opacity-50" aria-label="Close">×</button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7 sm:py-6">
          <form ref={formRef} action={submit} className="border-b border-[#E7ECF2] pb-6">
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="block">
                <span className="mb-2 block text-[9px] font-bold uppercase tracking-[.08em] text-[#475467]">Policy document</span>
                <input
                  name="policy_document"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  required
                  disabled={pending}
                  className="block h-[48px] w-full rounded-xl border border-[#D7DFE9] bg-white text-[10px] text-[#536174] shadow-sm outline-none transition file:mr-4 file:h-full file:border-0 file:border-r file:border-[#D7DFE9] file:bg-[#F2F6FB] file:px-5 file:text-[10px] file:font-semibold file:text-[#173B67] hover:border-[#AEBAC9] focus:border-[#315B9A] disabled:opacity-60"
                />
              </label>
              <button disabled={pending} className="h-[48px] rounded-xl bg-[#173B67] px-7 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#102E52] disabled:cursor-wait disabled:opacity-60">
                {pending ? "Reading document…" : hasResult ? "Read another document" : "Read document"}
              </button>
            </div>
            <p className="mt-2.5 text-[9px] leading-4 text-[#7C899A]">Supported formats: PDF, JPG, PNG and WebP. Customer and vehicle identification details are not copied from this document.</p>
          </form>

          {pending ? <div className="flex items-center gap-3 border-b border-[#E7ECF2] py-6 text-[#42566F]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#BFD0E5] border-t-[#173B67]" />
            <div>
              <p className="text-[10px] font-semibold">Reading policy schedule</p>
              <p className="mt-0.5 text-[9px] text-[#7A8798]">Keep this window open while the document is processed.</p>
            </div>
          </div> : null}

          {error ? <div className="mt-5 rounded-xl border border-[#F2C7C7] bg-[#FFF6F6] px-4 py-3 text-[10px] font-medium text-[#B42318]">{error}</div> : null}
          {warnings.length ? <div className="mt-5 rounded-xl border border-[#F0D9A8] bg-[#FFFAEE] px-4 py-3">
            {warnings.map((warning) => <p key={warning} className="text-[9px] leading-4 text-[#7A5514]">{warning}</p>)}
          </div> : null}

          {hasResult ? <section className="mt-6">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-[13px] font-bold text-[#152D4F]">Review extracted details</h3>
                <p className="mt-1 text-[9px] text-[#728095]">{documentName || "Policy document"}{parserInfo ? ` · ${parserInfo}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={selectAll} className="rounded-lg border border-[#CCD6E2] px-3 py-2 text-[9px] font-semibold text-[#29425F] hover:bg-[#F6F8FB]">Select all</button>
                <button type="button" onClick={() => setSelected(new Set())} className="rounded-lg border border-[#CCD6E2] px-3 py-2 text-[9px] font-semibold text-[#29425F] hover:bg-[#F6F8FB]">Clear</button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#DCE3EB]">
              <div className="hidden grid-cols-[42px_1.1fr_1.25fr_120px] border-b border-[#DCE3EB] bg-[#F5F7FA] px-3 py-2.5 text-[8px] font-bold uppercase tracking-[.08em] text-[#68768A] sm:grid">
                <span />
                <span>Form field</span>
                <span>Extracted value</span>
                <span>Review status</span>
              </div>
              <div className="divide-y divide-[#E5EAF0] bg-white">
                {editableFields.map((field) => {
                  const confidence = field.confidence === null ? null : Math.round(field.confidence * 100);
                  const ready = confidence === null || confidence >= 90;
                  return <label key={field.key} className={`grid cursor-pointer gap-2 px-3 py-3.5 transition sm:grid-cols-[42px_1.1fr_1.25fr_120px] sm:items-center ${selected.has(field.key) ? "bg-[#F5F8FD]" : "hover:bg-[#FAFBFC]"}`}>
                    <span className="flex items-center">
                      <input type="checkbox" checked={selected.has(field.key)} onChange={() => toggle(field.key)} className="h-4 w-4 rounded border-[#B9C4D2] text-[#315B9A] focus:ring-[#AFC5E2]" />
                    </span>
                    <span>
                      <span className="block text-[8px] font-bold uppercase tracking-[.055em] text-[#69778A] sm:hidden">Form field</span>
                      <span className="mt-0.5 block text-[10px] font-semibold text-[#243A57] sm:mt-0">{field.label}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[8px] font-bold uppercase tracking-[.055em] text-[#69778A] sm:hidden">Extracted value</span>
                      <span className="mt-0.5 block break-words text-[10.5px] font-semibold text-[#121F33] sm:mt-0">{formatFieldValue(field)}</span>
                      {field.page ? <span className="mt-0.5 block text-[8px] text-[#8A96A6]">Page {field.page}</span> : null}
                    </span>
                    <span>
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[8px] font-bold ${ready ? "bg-[#EAF7F0] text-[#18794E]" : "bg-[#FFF4DF] text-[#9A6412]"}`}>{ready ? "Ready" : "Verify"}</span>
                    </span>
                  </label>;
                })}
              </div>
            </div>

            {verificationFields.length ? <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-[10px] font-bold text-[#334A67]">Premium totals shown on the policy</h4>
                <span className="text-[8px] text-[#7B8797]">For comparison only</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-[#DFE5EC] bg-[#FAFBFC]">
                {verificationFields.map((field, index) => <div key={field.key} className={`flex items-center justify-between gap-4 px-4 py-3 ${index ? "border-t border-[#E5EAF0]" : ""}`}>
                  <span className="text-[9px] font-medium text-[#617086]">{field.label}</span>
                  <span className="text-[10px] font-bold text-[#213955]">{formatFieldValue(field)}</span>
                </div>)}
              </div>
              <p className="mt-2 text-[8.5px] leading-4 text-[#7A8798]">These totals are not copied. The onboarding form continues to calculate Net Premium, GST and Gross Premium from the selected premium components.</p>
            </div> : null}
          </section> : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-[#E2E8F0] bg-[#FAFBFC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <p className="text-[9px] text-[#69778A]">{hasResult ? `${selectedCount} of ${editableFields.length} fields selected` : "Review all values before applying them to the form."}</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} disabled={pending} className="h-10 rounded-xl border border-[#C9D3DF] bg-white px-5 text-[9.5px] font-semibold text-[#2B405B] transition hover:bg-[#F4F7FA] disabled:opacity-50">Cancel</button>
            <button type="button" onClick={applySelected} disabled={!selectedCount || pending} className="h-10 rounded-xl bg-[#315B9A] px-6 text-[9.5px] font-bold text-white shadow-sm transition hover:bg-[#264C83] disabled:cursor-not-allowed disabled:opacity-40">Apply selected details</button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  ) : null;

  return <>
    {variant==="icon"?<button type="button" onClick={()=>setOpen(true)} aria-label="Read policy copy" title="Read policy copy" className="grid h-8 w-8 place-items-center rounded-lg border border-[#D7E0EA] bg-white text-[#315B9A] shadow-sm transition hover:border-[#B8C8DC] hover:bg-[#F3F7FC] focus:outline-none focus:ring-2 focus:ring-[#DCE8FA]"><PolicyReadIcon/></button>:<button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-white/35 bg-white/10 px-4 py-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-white/20">Read Policy Copy</button>}
    {modal}
  </>;
}

function PolicyReadIcon(){return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8"/><path d="M14 2v6h6"/><path d="M9 13h3"/><path d="M9 17h2"/><circle cx="17" cy="16" r="3"/><path d="m19.2 18.2 2 2"/></svg>;}

function friendlyParserName(parserId: string) {
  if (parserId.startsWith("digit_")) return "Digit commercial vehicle format";
  if (parserId.startsWith("iffco_tokio_")) return "IFFCO-Tokio commercial vehicle format";
  if (parserId.startsWith("new_india_")) return "New India motor format";
  return "Standard motor policy format";
}

function friendlyMethod(method: string) {
  return method === "native_pdf_text" ? "digital policy" : "scanned policy";
}

function formatFieldValue(field: PolicyOcrField) {
  if (["idv", "od_premium", "tp_premium", "cpa_premium", "total_premium", "tax_amount", "gross_premium"].includes(field.key)) {
    const number = Number(field.value.replace(/,/g, ""));
    if (Number.isFinite(number)) return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(number);
  }
  return field.value;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(?:the|co|company|limited|ltd|general|insurance)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findControl(aliases: string[]) {
  const normalizedAliases = aliases.map((alias) => alias.toLowerCase().replace(/\s+/g, " ").trim());

  // Composite controls such as Policy validity use aria-labels on their nested inputs,
  // while the visible parent label is "Policy validity". Prefer aria-label matching so
  // Valid from / Valid upto are applied to the correct date input.
  const ariaControls = Array.from(document.querySelectorAll("input[aria-label],select[aria-label],textarea[aria-label]"));
  for (const control of ariaControls) {
    const aria = (control.getAttribute("aria-label") ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalizedAliases.some((alias) => aria === alias || aria.startsWith(alias))) continue;
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) return control;
  }

  const labels = Array.from(document.querySelectorAll("label"));
  for (const label of labels) {
    const text = (label.textContent ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!normalizedAliases.some((alias) => text.startsWith(alias))) continue;
    const control = label.querySelector("input,select,textarea") ?? label.parentElement?.querySelector("input,select,textarea");
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) return control;
  }
  return null;
}

function valueForControl(field: PolicyOcrField, control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  if (control instanceof HTMLInputElement && control.type === "date") return toIsoDate(field.value);
  if (!(control instanceof HTMLSelectElement)) return field.value;
  if (field.key === "policy_product") return matchPolicyProduct(control, field.value);
  if (field.key === "insurer_name") return matchInsurer(control, field.value);
  return matchSimpleOption(control, field.value);
}

function matchPolicyProduct(control: HTMLSelectElement, rawValue: string) {
  const wanted = normalizeText(rawValue);
  const canonical = Object.entries(PRODUCT_ALIASES).find(([, aliases]) => aliases.some((alias) => normalizeText(alias) === wanted || wanted.includes(normalizeText(alias))))?.[0] ?? rawValue;
  return findOptionValue(control, canonical);
}

function matchInsurer(control: HTMLSelectElement, rawValue: string) {
  const normalizedRaw = normalizeText(rawValue);
  const aliasKey = Object.entries(INSURER_ALIASES).find(([, aliases]) => aliases.some((alias) => normalizedRaw.includes(normalizeText(alias))))?.[0];
  const wantedTokens = new Set(normalizedRaw.split(" ").filter(Boolean));
  let best: { value: string; score: number } | null = null;

  for (const option of Array.from(control.options)) {
    if (!option.value) continue;
    const normalizedOption = normalizeText(option.textContent ?? option.label);
    const optionTokens = new Set(normalizedOption.split(" ").filter(Boolean));
    if (!optionTokens.size) continue;

    let score = Array.from(wantedTokens).filter((token) => optionTokens.has(token)).length / Math.max(wantedTokens.size, 1);
    if (aliasKey && INSURER_ALIASES[aliasKey].some((alias) => normalizedOption.includes(normalizeText(alias)))) score = Math.max(score, .95);
    if (!best || score > best.score) best = { value: option.value, score };
  }

  return best && best.score >= .5 ? best.value : "";
}

function matchSimpleOption(control: HTMLSelectElement, rawValue: string) {
  return findOptionValue(control, rawValue);
}

function findOptionValue(control: HTMLSelectElement, rawValue: string) {
  const wanted = normalizeText(rawValue);
  const exact = Array.from(control.options).find((option) => normalizeText(option.textContent ?? option.label) === wanted || normalizeText(option.value) === wanted);
  if (exact) return exact.value;
  const contains = Array.from(control.options).find((option) => {
    const optionText = normalizeText(option.textContent ?? option.label);
    return optionText && wanted && (optionText.includes(wanted) || wanted.includes(optionText));
  });
  return contains?.value ?? "";
}

function toIsoDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const months: Record<string, string> = { JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12" };
  const match = value.toUpperCase().match(/(\d{1,2})[-/]([A-Z]{3}|\d{1,2})[-/](\d{4})/);
  if (!match) return "";
  const month = months[match[2]] ?? match[2].padStart(2, "0");
  return `${match[3]}-${month}-${match[1].padStart(2, "0")}`;
}

function setNativeValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  if (!value) return false;
  const wasDisabled = control.disabled;
  if (wasDisabled) control.disabled = false;

  const prototype = control instanceof HTMLInputElement
    ? HTMLInputElement.prototype
    : control instanceof HTMLSelectElement
      ? HTMLSelectElement.prototype
      : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) {
    if (wasDisabled) control.disabled = true;
    return false;
  }

  setter.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
  if (wasDisabled) control.disabled = true;
  return control.value === value;
}
