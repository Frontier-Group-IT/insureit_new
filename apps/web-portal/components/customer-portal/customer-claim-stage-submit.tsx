"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

export function CustomerClaimStageSubmit({ formId }: { formId: string }) {
  const [saving, setSaving] = useState(false);

  function submitDetails() {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement) || saving) return;
    // Keep HTML5 required/date/number validation in force, including the
    // browser's native field-specific explanation and focus placement.
    if (!form.reportValidity()) return;
    setSaving(true);
    form.requestSubmit();
  }

  return (
    <button
      type="button"
      disabled={saving}
      aria-busy={saving}
      onClick={submitDetails}
      className="inline-flex min-h-10 min-w-[112px] items-center justify-center gap-2 rounded-lg bg-[#1253A7] px-6 text-[12px] font-bold text-white transition hover:bg-[#0B3884] disabled:cursor-wait disabled:opacity-70"
    >
      {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
      {saving ? "Saving..." : "Save Details"}
    </button>
  );
}
