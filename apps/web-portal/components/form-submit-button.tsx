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
  name,
  value,
}: {
  label?: string;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
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

  const isCurrentSubmission = pending && (!name || !value || data?.get(name) === value);
  const isDisabled = disabled || pending || (requireChange && !formChanged);

  return (
    <button
      ref={buttonRef}
      className={`${interactionClassName} ${className}`}
      type="submit"
      name={name}
      value={value}
      disabled={isDisabled}
      aria-busy={isCurrentSubmission}
      aria-live="polite"
      title={requireChange && !formChanged ? "Make a change before saving." : undefined}
    >
      {isCurrentSubmission ? <InsureItButtonLoader label={pendingLabel} /> : <>{icon}{label}</>}
    </button>
  );
}
