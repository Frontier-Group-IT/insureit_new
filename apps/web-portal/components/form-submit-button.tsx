"use client";

import { useFormStatus } from "react-dom";
import { InsureItButtonLoader } from "@/components/loading/insureit-loader";

export function FormSubmitButton({ label = "Save record", pendingLabel = "Saving" }: { label?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-accent)] px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#5D55D8] disabled:cursor-not-allowed disabled:opacity-80"
      type="submit"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? <InsureItButtonLoader label={pendingLabel} /> : label}
    </button>
  );
}
