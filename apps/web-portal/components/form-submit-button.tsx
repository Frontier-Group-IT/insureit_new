"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { InsureItButtonLoader } from "@/components/loading/insureit-loader";

const defaultClassName = "inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-accent)] px-4 py-2 text-[11px] font-semibold text-white shadow-sm hover:bg-[#5D55D8] disabled:cursor-not-allowed disabled:opacity-80";

export function FormSubmitButton({
  label = "Save changes",
  pendingLabel = "Saving changes",
  className = defaultClassName,
  disabled = false,
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [formChanged, setFormChanged] = useState(false);
  const requireChange = /^(Save primary details|Save & return to Documents|Save documents)$/i.test(label);

  useEffect(() => {
    if (!requireChange) return;
    const form = buttonRef.current?.closest("form");
    if (!form) return;

    setFormChanged(false);
    const markChanged = () => setFormChanged(true);
    form.addEventListener("input", markChanged);
    form.addEventListener("change", markChanged);
    return () => {
      form.removeEventListener("input", markChanged);
      form.removeEventListener("change", markChanged);
    };
  }, [requireChange, label]);

  const isDisabled = disabled || pending || (requireChange && !formChanged);

  return (
    <button
      ref={buttonRef}
      className={className}
      type="submit"
      disabled={isDisabled}
      aria-busy={pending}
      aria-live="polite"
      title={requireChange && !formChanged ? "Make a change before saving." : undefined}
    >
      {pending ? <InsureItButtonLoader label={pendingLabel} /> : label}
    </button>
  );
}
