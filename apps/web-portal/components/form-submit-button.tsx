"use client";

import { useFormStatus } from "react-dom";
import { InsureItLoader } from "@/components/loading/insureit-loader";

export function FormSubmitButton({ label = "Save record" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <>
      {pending ? (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-[#101828]/18 px-4 backdrop-blur-[2px]" aria-live="polite" aria-busy="true">
          <div className="rounded-2xl border border-white/70 bg-white/88 px-5 py-4 shadow-[0_18px_60px_rgba(16,24,40,0.2)] backdrop-blur-md">
            <InsureItLoader label="Saving changes" compact />
          </div>
        </div>
      ) : null}
      <button className="inline-flex items-center justify-center rounded-md bg-[var(--brand-accent)] px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#5D55D8] disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={pending}>
        {pending ? "Please wait" : label}
      </button>
    </>
  );
}
