"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";

export type SpotSaveState = { error: string | null };
const initialState: SpotSaveState = { error: null };

export function SpotIntimationSaveForm({ action, children, cancelHref, evidence, draftKey }: {
  action: (state: SpotSaveState, form: FormData) => Promise<SpotSaveState>;
  children: React.ReactNode;
  cancelHref: string;
  evidence?: React.ReactNode;
  draftKey: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const storageKey = "insureit:customer-spot-draft:" + draftKey;
  const fieldNames = ["accidentDate", "accidentTime", "spotDate", "spotTime", "driver", "phone", "location"] as const;

  // File upload redirects to this page; preserve the unsaved fields for this claim.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as { savedAt: number; values: Record<string, string> };
      if (!draft?.savedAt || Date.now() - draft.savedAt > 30 * 60 * 1000) {
        sessionStorage.removeItem(storageKey);
        return;
      }
      for (const name of fieldNames) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement && typeof draft.values?.[name] === "string") {
          input.value = draft.values[name];
        }
      }
    } catch {
      // Browser storage restrictions must not block claim entry.
    }
  }, [storageKey]);

  const saveDraft = () => {
    const form = formRef.current;
    if (!form) return;
    const values: Record<string, string> = {};
    for (const name of fieldNames) {
      const input = form.elements.namedItem(name);
      if (input instanceof HTMLInputElement) values[name] = input.value;
    }
    try { sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), values })); }
    catch { /* Browser storage is optional. */ }
  };
  return <div className="customer-workflow space-y-3"><form ref={formRef} id="customer-spot-intimation-form" onInput={saveDraft} onChange={saveDraft} action={formAction} aria-busy={pending} className="space-y-4 rounded-2xl border border-[#DBE4F0] bg-white p-4 shadow-[0_6px_24px_rgba(20,58,100,.04)] sm:p-5">
    {children}
    {state.error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{state.error}</p> : null}
    </form>
    {evidence}
    <div className="rounded-2xl border border-[#DBE4F0] bg-white p-3 sm:p-4"><div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
      {pending
        ? <span aria-disabled="true" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#B9CBE2] px-6 py-3 text-[13px] font-semibold text-[#9AAAC0] sm:min-w-32">Cancel</span>
        : <Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#B9CBE2] bg-white px-6 py-3 text-[13px] font-semibold text-[#17365D] transition hover:bg-[#F0F6FE] sm:min-w-32">Cancel</Link>}
      <button type="submit" form="customer-spot-intimation-form" disabled={pending} aria-disabled={pending} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1253A7] px-6 py-3 text-[13px] font-bold text-white transition hover:bg-[#0B3884] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1253A7] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-64">
        {pending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>Saving...</> : <>Save &amp; Continue <ArrowRight className="h-4 w-4" aria-hidden="true"/></>}
      </button>
    </div></div>
  </div>;
}
