"use client";

import { useEffect, useState } from "react";

function secondsRemaining(until: number) {
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export function LoginAccessActionButton({
  label,
  cooldownLabel,
  cooldownUntil = 0,
  className,
  disabled = false,
}: {
  label: string;
  cooldownLabel?: string;
  cooldownUntil?: number;
  className: string;
  disabled?: boolean;
}) {
  const [remaining, setRemaining] = useState(() => secondsRemaining(cooldownUntil));

  useEffect(() => {
    setRemaining(secondsRemaining(cooldownUntil));
    if (!cooldownUntil || cooldownUntil <= Date.now()) return;

    const timer = window.setInterval(() => {
      const next = secondsRemaining(cooldownUntil);
      setRemaining(next);
      if (next <= 0) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const coolingDown = remaining > 0;

  return (
    <button
      type="submit"
      disabled={disabled || coolingDown}
      className={className}
      title={coolingDown ? `Available again in ${remaining} seconds` : undefined}
    >
      {coolingDown ? `${cooldownLabel ?? label} in ${remaining}s` : label}
    </button>
  );
}

export function EmailCooldownNotice({ cooldownUntil }: { cooldownUntil: number }) {
  const [remaining, setRemaining] = useState(() => secondsRemaining(cooldownUntil));

  useEffect(() => {
    setRemaining(secondsRemaining(cooldownUntil));
    if (!cooldownUntil || cooldownUntil <= Date.now()) return;

    const timer = window.setInterval(() => {
      const next = secondsRemaining(cooldownUntil);
      setRemaining(next);
      if (next <= 0) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  if (remaining <= 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      An authentication email was sent recently. Please wait {remaining} second{remaining === 1 ? "" : "s"} before sending another one.
    </div>
  );
}
