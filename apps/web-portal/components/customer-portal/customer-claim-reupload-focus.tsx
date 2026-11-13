"use client";

import { useEffect } from "react";

/** Deep link only to the already authorized, rendered document control. */
export function CustomerClaimReuploadFocus({ requestId }: { requestId: string | null }) {
  useEffect(() => {
    if (!requestId) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    const scrollToRequest = () => {
      const target = document.getElementById("claim-reupload-target");
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    };
    // The document-group tab is client rendered; repeat once after hydration.
    timeouts.push(setTimeout(scrollToRequest, 80), setTimeout(scrollToRequest, 400));
    return () => timeouts.forEach(clearTimeout);
  }, [requestId]);
  return null;
}
