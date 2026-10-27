"use client";

import { useState } from "react";
import { AlertCircle, LoaderCircle, X } from "lucide-react";
import { saveCustomerClaimStageWithFeedback } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/actions";

export function CustomerClaimStageSubmit({ formId }: { formId: string }) {
  const [saving, setSaving] = useState<"draft" | "details" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function submit(mode: "draft" | "details") {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement) || saving) return;
    setFeedback("");
    setErrorMessage("");
    // Drafts deliberately allow empty required fields; final saves do not.
    if (mode === "details" && !form.reportValidity()) return;
    const data = new FormData(form);
    setSaving(mode);
    try {
      const result = await saveCustomerClaimStageWithFeedback(mode, data);
      if (result.error) {
        setErrorMessage(result.error);
        return;
      }
      setFeedback(mode === "draft" ? "Draft saved." : "Details saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message && !error.message.includes("NEXT_REDIRECT")
        ? error.message
        : "The save could not be completed. Your entries remain on this page. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button type="button" disabled={saving !== null} aria-busy={saving === "draft"} onClick={() => void submit("draft")}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#B9CBE2] px-5 text-[12px] font-semibold text-[#174A87] transition hover:bg-[#F0F6FF] disabled:opacity-65">
        {saving === "draft" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {saving === "draft" ? "Saving draft..." : "Save Draft"}
      </button>
      <button type="button" disabled={saving !== null} aria-busy={saving === "details"} onClick={() => void submit("details")}
        className="inline-flex min-h-10 min-w-[112px] items-center justify-center gap-2 rounded-lg bg-[#1253A7] px-6 text-[12px] font-bold text-white transition hover:bg-[#0B3884] disabled:opacity-70">
        {saving === "details" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {saving === "details" ? "Saving..." : "Save Details"}
      </button>
      {feedback ? <p role="status" aria-live="polite" className="w-full text-right text-[11px] font-semibold text-[#08744A]">{feedback}</p> : null}
      {errorMessage ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101828]/40 p-4">
          <div role="alertdialog" aria-modal="true" aria-labelledby="claim-save-error-title" aria-describedby="claim-save-error-description" className="w-full max-w-[370px] rounded-2xl border border-[#E5EAF2] bg-white p-4 shadow-2xl">
            <div className="flex items-start gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#FFF0F0] text-[#C72F3B]"><AlertCircle className="h-5 w-5" aria-hidden="true"/></div>
              <div className="min-w-0 flex-1">
                <h2 id="claim-save-error-title" className="text-[14px] font-bold text-[#18243D]">Action Required</h2>
                <p id="claim-save-error-description" className="mt-1 text-[11px] leading-[1.5] text-[#53627A]">{errorMessage}</p>
              </div>
              <button type="button" aria-label="Close error" onClick={()=>setErrorMessage("")} className="rounded-md p-1 text-[#718096] hover:bg-[#F1F5F9]"><X className="h-4 w-4"/></button>
            </div>
            <div className="mt-4 flex justify-end"><button type="button" autoFocus onClick={()=>setErrorMessage("")} className="min-w-[72px] rounded-lg bg-[#1253A7] px-4 py-2 text-[11px] font-bold text-white hover:bg-[#0B3884]">OK</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
