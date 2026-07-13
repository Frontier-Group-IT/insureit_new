"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton({ label = "Save record" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-accent)] px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#5D55D8] disabled:cursor-not-allowed disabled:opacity-70"
      type="submit"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" /> : null}
      {pending ? "Saving…" : label}
    </button>
  );
}
