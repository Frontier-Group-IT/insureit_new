"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { actionBaseClassName, primaryActionClassName } from "@/components/action-styles";
import { InsureItButtonLoader } from "@/components/loading/insureit-loader";

const defaultClassName = primaryActionClassName;
const interactionClassName = `${actionBaseClassName} cursor-pointer disabled:translate-y-0 disabled:shadow-none`;

export function FormSubmitButton({
  label = "Save changes",
  pendingLabel = "Saving changes",
  className = defaultClassName,
  disabled = false,
  icon,
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [formChanged, setFormChanged] = useState(false);
  const requireChange = /^(Save primary details|Save documents)$/i.test(label);

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
      className={`${interactionClassName} ${className}`}
      type="submit"
      disabled={isDisabled}
      aria-busy={pending}
      aria-live="polite"
      title={requireChange && !formChanged ? "Make a change before saving." : undefined}
    >
      {pending ? <InsureItButtonLoader label={pendingLabel} /> : <>{icon}{label}</>}
    </button>
  );
}
