"use client";

import { useEffect, useRef } from "react";

export function AutoCloseTimeInput({
  name,
  required,
  ariaLabel,
  className,
}: {
  name: string;
  required?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  return (
    <input
      ref={inputRef}
      name={name}
      type="time"
      required={required}
      aria-label={ariaLabel}
      className={className}
      onChange={(event) => {
        const value = event.currentTarget.value;
        if (closeTimer.current) clearTimeout(closeTimer.current);
        if (!/^\d{2}:\d{2}$/.test(value)) return;
        closeTimer.current = setTimeout(() => {
          inputRef.current?.blur();
          closeTimer.current = null;
        }, 450);
      }}
    />
  );
}
