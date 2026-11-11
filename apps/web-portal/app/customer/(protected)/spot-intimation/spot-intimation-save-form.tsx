"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { CustomerErrorDialog } from "@/components/customer-portal/customer-error-dialog";
import { CustomerSuccessDialog } from "@/components/customer-portal/customer-success-dialog";
import type { SpotDraftFields, SpotDraftResult } from "./draft-actions";

export type SpotSaveState = { error: string | null; destination?: string };
const initialState: SpotSaveState = { error: null };

export function SpotIntimationSaveForm({ action, children, cancelHref, evidence, draftKey, editMode = false, serverDraft, saveServerDraft }: {
  action: (state: SpotSaveState, form: FormData) => Promise<SpotSaveState>;
  children: React.ReactNode;
  cancelHref: string;
  evidence?: React.ReactNode;
  draftKey: string;
  editMode?: boolean;
  serverDraft?: { fields: SpotDraftFields; updatedAt: string } | null;
  saveServerDraft?: (fields: SpotDraftFields) => Promise<SpotDraftResult>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const restoredDraftKey=useRef<string|null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [successNotice,setSuccessNotice]=useState<string|null>(null);
  const savedDestination=useRef<string|null>(null);
  const closeError = useCallback(() => setDialogError(null), []);
  const closeSuccess=useCallback(()=>{
    setSuccessNotice(null);
    const destination=savedDestination.current;
    savedDestination.current=null;
    if(destination)router.push(destination);
  },[router]);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncSequence = useRef(0);
  const syncQueue = useRef<Promise<void>>(Promise.resolve());
  const [syncState, setSyncState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const storageKey = "insureit:customer-spot-draft:" + draftKey;
  const fieldNames = ["accidentDate", "accidentTime", "spotDate", "spotTime", "driver", "phone", "location"] as const;

  // File upload redirects to this page; preserve the unsaved fields for this claim.
  useEffect(() => {
    const form = formRef.current;
    // A server refresh must not overwrite inputs the customer is editing.
    if (!form || restoredDraftKey.current === storageKey) return;
    restoredDraftKey.current=storageKey;
    try {
      const raw = sessionStorage.getItem(storageKey);
      const local = raw ? JSON.parse(raw) as { savedAt: number; values: Record<string, string> } : null;
      const localIsRecent = Boolean(local?.savedAt && Date.now() - local.savedAt <= 30 * 60 * 1000);
      if (raw && !localIsRecent) sessionStorage.removeItem(storageKey);
      const serverAt = serverDraft?.updatedAt ? new Date(serverDraft.updatedAt).getTime() : 0;
      const values = localIsRecent && (local?.savedAt ?? 0) > serverAt ? local?.values : serverDraft?.fields;
      if (!values) return;
      for (const name of fieldNames) {
        const input = form.elements.namedItem(name);
        if (input instanceof HTMLInputElement && typeof values[name] === "string") {
          input.value = values[name];
          // The date picker renders a controlled DD/MM/YYYY display.
          if (input.type === "date") input.dispatchEvent(new CustomEvent("customer-spot-draft-restore", { detail: values[name] }));
        }
      }
    } catch {
      // Browser storage restrictions must not block claim entry.
    }
  }, [storageKey, serverDraft]);

  const collectDraft = (): SpotDraftFields | null => {
    const form = formRef.current;
    if (!form) return null;
    const fields = {} as SpotDraftFields;
    for (const name of fieldNames) {
      const input = form.elements.namedItem(name);
      fields[name] = input instanceof HTMLInputElement ? input.value : "";
    }
    return fields;
  };
  const saveDraft = () => {
    const values = collectDraft();
    if (!values) return;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), values })); }
    catch { /* Browser storage is optional. */ }
  };
  const syncDraft = () => {
    if (!saveServerDraft || pending) return;
    const values = collectDraft();
    if (!values) return;
    const sequence = ++syncSequence.current;
    setSyncState("saving");
    // Serialize writes: a slower previous request must never overwrite newer typing.
    syncQueue.current = syncQueue.current.catch(() => {}).then(async () => {
      const result = await saveServerDraft(values);
      if (sequence === syncSequence.current) setSyncState(result.ok ? "saved" : "error");
    }).catch(() => {
      if (sequence === syncSequence.current) setSyncState("error");
    });
  };
  const queueSync = () => {
    saveDraft();
    if (syncTimer.current) clearTimeout(syncTimer.current);
    if (saveServerDraft && !pending) syncTimer.current = setTimeout(syncDraft, 650);
  };
  useEffect(() => () => {
    if (syncTimer.current) clearTimeout(syncTimer.current);
  }, []);
  return <div className="customer-workflow space-y-3"><CustomerErrorDialog message={dialogError} onClose={closeError} /><CustomerSuccessDialog title="Saved Successfully" message={successNotice} onClose={closeSuccess}/><form ref={formRef} id="customer-spot-intimation-form" noValidate onSubmit={async (event) => {
    event.preventDefault(); // Prevent native form-action resetting entered values on validation errors.
    if (pending || successNotice) return;
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncSequence.current++;
    saveDraft();
    const invalid = Array.from(event.currentTarget.elements).find((element) => element instanceof HTMLInputElement && !element.checkValidity());
    if (invalid instanceof HTMLInputElement) {
      event.preventDefault();
      setDialogError(invalid.validity.valueMissing ? "Please complete " + (invalid.getAttribute("aria-label") || invalid.name || "the required field") + "." : invalid.validationMessage);
      invalid.focus();
      return;
    }
    const currentForm = event.currentTarget;
    const payload = new FormData(currentForm);
    setPending(true);
    setDialogError(null);
    try {
      const result = await action(initialState, payload);
      if (result.error) {
        setDialogError(result.error);
      } else if (result.destination) {
        // Only clear the local draft after the backend confirms the save.
        try { window.sessionStorage.removeItem(storageKey); } catch {}
        savedDestination.current=result.destination;
        setSuccessNotice(editMode ? "Spot Intimation changes saved successfully." : "Spot Intimation details saved successfully.");
      }
    } catch {
      setDialogError("Unable to save claim details. Your entries are preserved; please try again.");
    } finally {
      setPending(false);
    }
  }} onInput={queueSync} onChange={queueSync} onBlurCapture={() => { if (syncTimer.current) clearTimeout(syncTimer.current); syncDraft(); }} aria-busy={pending} className="rounded-2xl border border-[#DBE4F0] bg-white p-4 shadow-[0_6px_24px_rgba(20,58,100,.04)] sm:p-5">
    {children}
    </form>
    {evidence}
    <div className="rounded-2xl border border-[#DBE4F0] bg-white p-3 sm:p-4"><div className="flex flex-col-reverse justify-end gap-2 border-t border-[#D9E3F0] pt-3 sm:flex-row">
      {pending
        ? <span aria-disabled="true" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#B9CBE2] px-6 py-3 text-[13px] font-semibold text-[#9AAAC0] sm:min-w-32">Cancel</span>
        : <Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#B9CBE2] bg-white px-6 py-3 text-[13px] font-semibold text-[#17365D] transition hover:bg-[#F0F6FE] sm:min-w-32">Cancel</Link>}
      <button type="submit" form="customer-spot-intimation-form" disabled={pending || Boolean(successNotice)} aria-disabled={pending || Boolean(successNotice)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1253A7] px-6 py-3 text-[13px] font-bold text-white transition hover:bg-[#0B3884] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1253A7] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:min-w-64">
        {pending ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>Saving...</> : <>{editMode ? "Save Changes" : "Save & Continue"} <ArrowRight className="h-4 w-4" aria-hidden="true"/></>}
      </button>
    </div></div>
  </div>;
}
