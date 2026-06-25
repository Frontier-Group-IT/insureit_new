"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestSpotSurveyDocumentReupload } from "@/app/claims/[id]/spot-survey-actions";

type Result = { ok: boolean; message?: string };

export function RequestReuploadButton({ claimId, documentId, documentTitle }: { claimId: string; documentId: string; documentTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Result | null>(null);

  return (
    <>
      <button type="button" onClick={() => { setResult(null); setOpen(true); }} className="h-8 rounded-md border border-[#D08700] bg-white px-2 text-[11px] font-semibold text-[#A35B00] transition hover:bg-[#FFF8E8]">
        Reupload
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071D49]/45 px-4">
          <form
            action={(formData) => {
              startTransition(async () => {
                formData.set("claimId", claimId);
                formData.set("documentId", documentId);
                const response = await requestSpotSurveyDocumentReupload(formData);
                setResult(response);
                if (response.ok) router.refresh();
              });
            }}
            className="w-full max-w-[520px] rounded-2xl bg-white shadow-xl"
          >
            <div className="border-b border-[#E6EEF7] px-5 py-4">
              <h2 className="text-[18px] font-semibold text-[#071D49]">Reupload Request</h2>
              <p className="mt-1 text-[13px] text-[#4B596B]">Ask the customer to upload a fresh copy of {documentTitle}.</p>
            </div>
            <div className="space-y-3 px-5 py-4">
              <label className="block">
                <span className="text-[12px] font-semibold text-[#071D49]">Reason shown to customer</span>
                <textarea name="reason" defaultValue={`${documentTitle} is not clear/valid. Please reupload a fresh copy.`} className="mt-1 min-h-[90px] w-full resize-none rounded-lg border border-[#C9D4E3] px-3 py-2 text-[13px] text-[#071D49] outline-none focus:border-[#174EA6]" />
              </label>
              {result ? <p className={`rounded-lg border px-3 py-2 text-[12px] font-semibold ${result.ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>{result.message ?? (result.ok ? "Reupload requested." : "Request failed.")}</p> : null}
            </div>
            <div className="flex items-center justify-between border-t border-[#E6EEF7] px-5 py-4">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-lg border border-[#B8C5D6] px-6 text-[13px] font-semibold text-[#071D49]">{result?.ok ? "Close" : "Cancel"}</button>
              <button type="submit" disabled={pending || Boolean(result?.ok)} className="h-10 rounded-lg bg-[#D08700] px-7 text-[13px] font-semibold text-white disabled:opacity-60">{pending ? "Sending..." : result?.ok ? "Requested" : "Send Reupload Request"}</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
