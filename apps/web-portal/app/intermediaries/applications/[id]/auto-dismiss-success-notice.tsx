"use client";

import { useEffect, useState } from "react";

export function AutoDismissSuccessNotice({ text, durationMs = 4000 }: { text: string; durationMs?: number }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisible(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      url.searchParams.delete("refresh");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }, durationMs);

    return () => window.clearTimeout(timer);
  }, [durationMs]);

  if (!visible) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10.5px] text-emerald-700" role="status">
      {text}
    </div>
  );
}
