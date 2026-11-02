"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { saveCustomerClaimStageWithFeedback } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/actions";

export function CustomerClaimStageSubmit({ formId, variant = "intimation" }: { formId: string; variant?: "intimation" | "continue" }) {
  const [saving, setSaving] = useState<"draft" | "details" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [errorPopup, setErrorPopup] = useState("");

  async function submit(mode: "draft" | "details") {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement) || saving) return;
    setFeedback("");
    setErrorPopup("");
    // Drafts deliberately allow empty required fields; final saves do not.
    if (mode === "details" && !form.reportValidity()) return;
    const data = new FormData(form);
    setSaving(mode);
    try {
      const result = await saveCustomerClaimStageWithFeedback(mode, data);
      if (result.error) {
        setErrorPopup(result.error);
        return;
      }
      setFeedback(mode === "draft" ? "Draft saved." : "Details saved.");
    } catch (error) {
      setErrorPopup(error instanceof Error && error.message && !error.message.includes("NEXT_REDIRECT")
        ? error.message
        : "The save could not be completed. Your entries remain on this page. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {variant === "intimation" ? <button type="button" disabled={saving !== null} aria-busy={saving === "draft"} onClick={() => void submit("draft")}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#B9CBE2] px-5 text-[12px] font-semibold text-[#174A87] transition hover:bg-[#F0F6FF] disabled:opacity-65">
        {saving === "draft" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {saving === "draft" ? "Saving draft..." : "Save Draft"}
      </button> : null}
      <button type="button" disabled={saving !== null} aria-busy={saving === "details"} onClick={() => void submit("details")}
        className="inline-flex min-h-10 min-w-[112px] items-center justify-center gap-2 rounded-lg bg-[#1253A7] px-6 text-[12px] font-bold text-white transition hover:bg-[#0B3884] disabled:opacity-70">
        {saving === "details" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {saving === "details" ? "Saving..." : variant === "continue" ? "Save & Continue" : "Save Details"}
      </button>
      {feedback ? <p role="status" aria-live="polite" className="w-full text-right text-[12px] font-semibold text-emerald-700">{feedback}</p> : null}
      {errorPopup ? <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#071D49]/40 p-4" role="presentation">
        <div role="alertdialog" aria-modal="true" aria-labelledby="customer-claim-error-title" aria-describedby="customer-claim-error-message" className="w-full max-w-sm rounded-2xl border border-red-100 bg-white p-5 shadow-2xl">
          <h2 id="customer-claim-error-title" className="text-[15px] font-bold text-[#17365D]">Action required</h2>
          <p id="customer-claim-error-message" className="mt-2 text-[12px] text-[#AD2732]">{errorPopup}</p>
          <div className="mt-5 flex justify-end"><button autoFocus type="button" onClick={() => setErrorPopup("")} className="rounded-lg bg-[#17365D] px-5 py-2 text-[12px] font-semibold text-white">OK</button></div>
        </div>
      </div> : null}
    </div>
  );
}
