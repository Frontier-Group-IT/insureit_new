"use client";

import { useFormStatus } from "react-dom";
import { InsureItLoader } from "@/components/loading/insureit-loader";

export function FormSubmitButton({ label = "Save record" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <>
      {pending ? (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-[#101828]/14 px-4 backdrop-blur-[1.5px]" aria-live="polite" aria-busy="true">
          <div className="rounded-2xl border border-white/70 bg-white/84 px-5 py-4 shadow-[0_18px_60px_rgba(16,24,40,0.2)] backdrop-blur-md">
            <InsureItLoader label="Saving changes" compact />
          </div>
        </div>
      ) : null}
      <button className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-accent)] px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#5D55D8] disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={pending}>
        {pending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : null}
        {pending ? "Saving..." : label}
      </button>
    </>
  );
}
