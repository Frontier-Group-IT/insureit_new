"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { InsureItButtonLoader } from "@/components/loading/insureit-loader";
import { markSpotSurveyDone } from "./survey-done-actions";

export function SurveyDoneButton({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const response = await markSpotSurveyDone(claimId);
            if (response.ok) {
              router.push(`/claims/${claimId}/final-documents`);
              router.refresh();
              return;
            }
            setMessage(response.message ?? "Unable to mark survey done.");
          });
        }}
        className="h-10 min-w-[126px] rounded-lg bg-[#071D49] px-5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#12356C] disabled:cursor-not-allowed disabled:bg-[#A9B4C5]"
      >
        {pending ? <InsureItButtonLoader label="Saving" /> : "Survey Done"}
      </button>
      {message ? <p className="max-w-[260px] text-right text-[11px] font-semibold text-red-600">{message}</p> : null}
    </div>
  );
}
