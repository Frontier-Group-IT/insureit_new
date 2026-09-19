"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

export function PendingButton({
  children,
  pendingLabel = "Processing…",
  disabled,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const blocked = Boolean(disabled || pending);

  return (
    <button
      {...props}
      type={props.type ?? "submit"}
      disabled={blocked}
      aria-busy={pending}
      className={className}
    >
      {pending ? (
        <>
          <LoaderCircle className="h-3 w-3 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : children}
    </button>
  );
}
