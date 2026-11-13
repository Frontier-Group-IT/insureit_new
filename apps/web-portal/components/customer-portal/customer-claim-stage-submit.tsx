"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearCustomerClaimDraft, customerClaimStageDraftKey, saveCustomerClaimDraft } from "@/components/customer-portal/customer-claim-stage-draft-form";
import { LoaderCircle } from "lucide-react";
import { ClaimStageErrorDialog } from "@/components/claim-manager/claim-stage-error-dialog";
import { saveCustomerClaimStageWithFeedback } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/actions";

export function CustomerClaimStageSubmit({ formId, variant = "intimation" }: { formId: string; variant?: "intimation" | "continue" }) {
  const router = useRouter();
  const [saving, setSaving] = useState<"draft" | "details" | null>(null);
  const [errorPopup, setErrorPopup] = useState("");

  async function submit(mode: "draft" | "details") {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement) || saving) return;
    setErrorPopup("");
    // Drafts deliberately allow empty required fields; final saves do not.
    if (mode === "details" && !form.reportValidity()) return;
    const data = new FormData(form);
    const key = customerClaimStageDraftKey(String(data.get("account") || ""), String(data.get("claim") || ""), String(data.get("stage") || ""));
    saveCustomerClaimDraft(form, key);
    setSaving(mode);
    let navigating = false;
    try {
      const result = await saveCustomerClaimStageWithFeedback(mode, data);
      if (result.error) {
        setErrorPopup(result.error);
        return;
      }
      if (!result.destination) {
        setErrorPopup("The save completed, but the next page could not be determined. Please refresh and try again.");
        return;
      }
      clearCustomerClaimDraft(key);
      // Keep the button in its Saving state until the next page mounts.
      navigating = mode === "details";
      router.push(result.destination);
    } catch (error) {
      navigating = false;
      setErrorPopup(error instanceof Error && error.message && !error.message.includes("NEXT_REDIRECT")
        ? error.message
        : "The save could not be completed. Your entries remain on this page. Please try again.");
    } finally {
      if (!navigating) setSaving(null);
    }
  }

  return (
    <div className="relative flex flex-wrap items-center justify-end gap-2">
      {variant === "intimation" ? <button type="button" disabled={saving !== null} aria-busy={saving === "draft"} onClick={() => void submit("draft")}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#B9CBE2] px-5 text-[12px] font-semibold text-[#174A87] transition hover:bg-[#F0F6FF] disabled:opacity-65">
        {saving === "draft" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {saving === "draft" ? "Saving draft..." : "Save Draft"}
      </button> : null}
      <button type="button" data-claim-stage-save={formId} disabled={saving !== null} aria-busy={saving === "details"} onClick={() => void submit("details")}
        className={`inline-flex min-h-10 ${variant === "continue" ? "min-w-[148px]" : "min-w-[112px]"} items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#1253A7] px-6 text-[12px] font-bold text-white transition hover:bg-[#0B3884] disabled:opacity-70`}>
        {saving === "details" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {saving === "details" ? "Saving..." : variant === "continue" ? "Save & Continue" : "Save Details"}
      </button>
      <ClaimStageErrorDialog message={errorPopup} onClose={() => setErrorPopup("")} />
    </div>
  );
}
