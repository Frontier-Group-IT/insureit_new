"use client";

import { useFormStatus } from "react-dom";
import { InsureItButtonLoader } from "@/components/loading/insureit-loader";

const defaultClassName = "inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-accent)] px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#5D55D8] disabled:cursor-not-allowed disabled:opacity-80";

export function FormSubmitButton({
  label = "Save record",
  pendingLabel = "Saving",
  className = defaultClassName,
  disabled = false,
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? <InsureItButtonLoader label={pendingLabel} /> : label}
    </button>
  );
}
