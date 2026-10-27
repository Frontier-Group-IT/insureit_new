"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { saveCustomerClaimStageWithFeedback } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/actions";

export function CustomerClaimStageSubmit({ formId }: { formId: string }) {
  const [saving, setSaving] = useState<"draft" | "details" | null>(null);
  const [feedback, setFeedback] = useState("");

  async function submit(mode: "draft" | "details") {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement) || saving) return;
    setFeedback("");
    // Drafts deliberately allow empty required fields; final saves do not.
    if (mode === "details" && !form.reportValidity()) return;
    const data = new FormData(form);
    setSaving(mode);
    try {
      const result = await saveCustomerClaimStageWithFeedback(mode, data);
      if (result.error) {
        setFeedback(result.error);
        return;
      }
      setFeedback(mode === "draft" ? "Draft saved." : "Details saved.");
    } catch (error) {
      setFeedback(error instanceof Error && error.message && !error.message.includes("NEXT_REDIRECT")
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
      {feedback ? <p role="status" aria-live="polite" className="w-full rounded-lg border border-[#F4C3C3] bg-[#FFF3F3] px-3 py-2 text-left text-[12px] font-semibold text-[#AD2732]">{feedback}</p> : null}
    </div>
  );
}
