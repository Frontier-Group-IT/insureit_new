"use client";

import { useFormStatus } from "react-dom";

export function FormSubmitButton({ label = "Save record" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy-900 disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={pending}>
      {pending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> : null}
      {pending ? "Saving..." : label}
    </button>
  );
}
