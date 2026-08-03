"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function RefreshOnFocus({ minimumIntervalMs = 5000 }: { minimumIntervalMs?: number }) {
  const router = useRouter();
  const lastRefreshAt = useRef(Date.now());

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefreshAt.current < minimumIntervalMs) return;
      lastRefreshAt.current = now;
      router.refresh();
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [minimumIntervalMs, router]);

  return null;
}
