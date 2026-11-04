"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

/**
 * Confirmation after a successful Customer Spot Intimation correction.
 * The URL marker is consumed immediately so refresh/back navigation never
 * shows a stale success message. All form and claim data remain unchanged.
 */
export function CustomerSpotSaveSuccess() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("updated") === "1") {
      url.searchParams.delete("updated");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }

    const timeout = window.setTimeout(() => setVisible(false), 2000);
    return () => window.clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center px-4" role="status" aria-live="polite" aria-atomic="true">
      <div className="flex w-full max-w-[490px] flex-col items-center gap-5 rounded-[22px] border border-[#E8ECF2] bg-white px-6 py-7 text-center shadow-[0_12px_40px_rgba(20,39,69,0.16)]">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E9FBF2] text-[#0B9A72]" aria-hidden="true">
          <Check className="h-6 w-6" strokeWidth={2.5} />
        </span>
        <span className="text-[18px] font-medium leading-6 text-[#0B2450]">Spot Intimation details saved.</span>
      </div>
    </div>
  );
}
