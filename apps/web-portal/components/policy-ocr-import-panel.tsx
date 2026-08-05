"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { extractPolicyDocument, type PolicyOcrField } from "@/app/policies/policy-ocr-actions";

const FIELD_TARGETS: Record<string, string[]> = {
  policy_number: ["policy number"], insurer_name: ["insurance company", "insurer"], policy_product: ["policy product"],
  insured_name: ["insured name"], registration_number: ["registration number"], chassis_number: ["chassis number"],
  engine_number: ["engine number"], make: ["make"], model: ["model"], fuel_type: ["fuel type"],
  manufacturing_year: ["manufacturing year"], vehicle_class: ["vehicle class"], policy_start_date: ["valid from"],
  policy_end_date: ["valid upto", "valid up to"], idv: ["idv"], od_premium: ["od premium"], tp_premium: ["tp premium"],
  cpa_premium: ["cpa premium"], phone_number: ["phone number"], rto_state: ["rto state"], rto_name: ["rto name"],
};

export function PolicyOcrImportPanel() {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<PolicyOcrField[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [model, setModel] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedCount = selected.size;
  const confidenceSummary = useMemo(() => {
    const scored = fields.filter((field) => field.confidence !== null);
    if (!scored.length) return null;
    return Math.round(scored.reduce((sum, field) => sum + (field.confidence ?? 0), 0) / scored.length * 100);
  }, [fields]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && !pending) setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, pending]);

  function submit(formData: FormData) {
    setError(null); setFields([]); setSelected(new Set()); setWarnings([]); setModel(null);
    startTransition(async () => {
      const result = await extractPolicyDocument(formData);
      if (!result.ok) { setError(result.error); return; }
      setFields(result.fields);
      setModel(result.model);
      setWarnings(result.warnings);
      setSelected(new Set(result.fields.filter((field) => (field.confidence ?? 0) >= .8).map((field) => field.key)));
    });
  }

  function toggle(key: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }

  function applySelected() {
    const chosen = fields.filter((field) => selected.has(field.key));
    let applied = 0;
    for (const field of chosen) {
      const control = findControl(FIELD_TARGETS[field.key] ?? []);
      if (!control) continue;
      setNativeValue(control, field.value);
      applied += 1;
    }
    if (!applied) {
      setError("Extracted fields could not be matched to the current form. The policy form field mapping needs updating.");
      return;
    }
    setError(null);
    setOpen(false);
    document.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const modal = open && typeof document !== "undefined" ? createPortal(
    <div className="fixed inset-0 z-[9999] grid h-[100dvh] w-screen place-items-center bg-[#071D49]/65 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-label="Read policy copy with OCR">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/60 bg-white shadow-[0_30px_100px_rgba(7,29,73,.45)] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-3xl">
        <div className="flex shrink-0 items-start justify-between border-b border-[#E6EBF2] bg-[linear-gradient(135deg,#F8FAFD,#EEF4FB)] px-4 py-4 sm:px-5">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-[15px] font-bold text-[#102A4C]">Read policy copy with OCR</h2><span className="rounded-full bg-[#EEF2FF] px-2 py-1 text-[8px] font-bold text-[#4338CA]">PaddleOCR test</span></div>
            <p className="mt-1 text-[9.5px] text-[#667085]">Upload a PDF or image, review extracted values, then apply selected details to the policy form.</p>
          </div>
          <button type="button" onClick={() => !pending && setOpen(false)} disabled={pending} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D8DEE9] bg-white text-lg text-[#475467] hover:bg-[#F2F5F9] disabled:opacity-50" aria-label="Close">×</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <form action={submit} className="rounded-2xl border border-[#DCE5F0] bg-[#F8FAFD] p-4">
            <label className="block text-[9px] font-bold uppercase tracking-[.08em] text-[#475467]">Policy document</label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input name="policy_document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required className="min-w-0 flex-1 rounded-xl border border-[#D8DEE9] bg-white text-[9.5px] text-[#475569] file:mr-3 file:border-0 file:bg-[#E8EEFF] file:px-4 file:py-3 file:text-[9px] file:font-semibold file:text-[#315FEA]" />
              <button disabled={pending} className="rounded-xl bg-[#17365D] px-5 py-3 text-[9.5px] font-bold text-white disabled:opacity-50">{pending ? "Reading policy…" : "Read policy copy"}</button>
            </div>
            <p className="mt-2 text-[8.5px] text-[#94A3B8]">Supported: PDF, JPG, PNG and WebP. Review all extracted values before applying.</p>
          </form>

          {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10px] font-semibold text-red-700">{error}</p> : null}
          {warnings.map((warning) => <p key={warning} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[9px] text-amber-800">{warning}</p>)}

          {fields.length ? <div className="mt-5">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] font-semibold text-[#17203A]">{fields.length} fields extracted{model ? ` using ${model}` : ""}{confidenceSummary !== null ? ` · average confidence ${confidenceSummary}%` : ""}</p>
              <button type="button" onClick={() => setSelected(new Set())} className="self-start rounded-lg border border-[#CBD5E1] px-3 py-2 text-[9px] font-semibold">Clear selection</button>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{fields.map((field) => {
              const confidence = field.confidence === null ? null : Math.round(field.confidence * 100);
              return <label key={field.key} className={`flex cursor-pointer gap-3 rounded-xl border p-3 ${selected.has(field.key) ? "border-[#818CF8] bg-[#F5F3FF]" : "border-[#E2E8F0] bg-white"}`}><input type="checkbox" checked={selected.has(field.key)} onChange={() => toggle(field.key)} className="mt-1"/><span className="min-w-0"><span className="block text-[8px] font-bold uppercase tracking-wide text-[#64748B]">{field.label}</span><span className="mt-1 block break-words text-[10.5px] font-semibold text-[#17203A]">{field.value}</span><span className="mt-1 block text-[8px] text-[#94A3B8]">{confidence === null ? "Confidence unavailable" : `${confidence}% confidence`}{field.page ? ` · page ${field.page}` : ""}</span></span></label>;
            })}</div>
          </div> : null}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-[#E6EBF2] bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <p className="text-[8.5px] text-[#667085]">Only selected values will be copied into the onboarding form.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={pending} className="rounded-xl border border-[#CBD5E1] px-4 py-2.5 text-[9.5px] font-semibold disabled:opacity-50">Cancel</button>
            <button type="button" onClick={applySelected} disabled={!selectedCount || pending} className="rounded-xl bg-[#315FEA] px-5 py-2.5 text-[9.5px] font-bold text-white disabled:opacity-40">Apply selected details ({selectedCount})</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  ) : null;

  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-white/35 bg-white/10 px-4 py-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-white/20">Read Policy Copy</button>
    {modal}
  </>;
}

function findControl(aliases: string[]) {
  if (!aliases.length) return null;
  const labels = Array.from(document.querySelectorAll("label"));
  for (const label of labels) {
    const text = (label.textContent ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!aliases.some((alias) => text.startsWith(alias))) continue;
    const control = label.querySelector("input,select,textarea") ?? label.parentElement?.querySelector("input,select,textarea");
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) return control;
  }
  return null;
}

function setNativeValue(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  const prototype = control instanceof HTMLInputElement ? HTMLInputElement.prototype : control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}
