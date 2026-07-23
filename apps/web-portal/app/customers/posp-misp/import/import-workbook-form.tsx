"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { FormSubmitButton } from "@/components/form-submit-button";
import { BlockingWorkPanel } from "@/components/loading/insureit-loader";
import { FeedbackToast } from "@/components/ui-feedback";
import type { PospMispState } from "../actions";

type Props = { action: (state: PospMispState, data: FormData) => Promise<PospMispState> };

export function ImportWorkbookForm({ action }: Props) {
  const [state, formAction] = useActionState(action, { error: null, field: null });
  const [showError, setShowError] = useState(false);
  const [fileName, setFileName] = useState("");

  useEffect(() => setShowError(Boolean(state.error)), [state.error]);

  return (
    <>
      {state.error && showError ? <FeedbackToast tone="error" message={state.error} onClose={() => setShowError(false)} /> : null}
      <form action={formAction} className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
        <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <h2 className="text-[15px] font-semibold text-[#0F172A]">Upload POSP / MISP workbook</h2>
          <p className="mt-1 text-[11px] text-[#64748B]">The POSP and MISP sheets are parsed into a review batch before applications are submitted.</p>
        </div>
        <div className="space-y-4 p-5">
          <label htmlFor="workbook" className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-6 text-center hover:border-[#6366F1]">
            <span className="text-[13px] font-semibold text-[#0F172A]">{fileName || "Choose Excel file"}</span>
            <span className="mt-1 text-[10.5px] text-[#64748B]">Secure .xlsx only, up to 5 MB, with POSP and MISP tabs.</span>
          </label>
          <input id="workbook" name="workbook" type="file" required accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} />
          <WorkbookPendingPanel />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#E2E8F0] bg-white px-5 py-3">
          <Link href="/customers/posp-misp" className="rounded-md border border-[#CBD5E1] px-4 py-2 text-[11px] font-semibold text-[#334155]">Cancel</Link>
          <FormSubmitButton label="Parse Workbook" pendingLabel="Parsing" />
        </div>
      </form>
    </>
  );
}

function WorkbookPendingPanel() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <BlockingWorkPanel title="Reading workbook" detail="Validating POSP and MISP rows for review." />;
}
