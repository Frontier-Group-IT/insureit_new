"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

export function CustomerClaimStageSuccessToast() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div role="status" aria-live="polite" className="fixed right-4 top-20 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-[#B8E2CA] bg-white px-4 py-3 text-[12px] font-bold text-[#08744A] shadow-[0_8px_28px_rgba(17,68,49,.13)] sm:right-6">
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      Stage details saved successfully
    </div>
  );
}
