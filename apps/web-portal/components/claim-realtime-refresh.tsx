"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/auth";

function claimIdFromPath(pathname: string) {
  const match = pathname.match(/^\/claims\/([0-9a-f-]{36})(?:\/|$)/i);
  return match?.[1] ?? null;
}

export function ClaimRealtimeRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const claimId = claimIdFromPath(pathname);
  const versionRef = useRef<string | null>(null);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!claimId) return;

    const scheduleRefresh = () => {
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = window.setTimeout(() => router.refresh(), 150);
    };

    let cancelled = false;
    const checkVersion = async () => {
      try {
        const response = await fetch(`/api/claims/${claimId}/sync-version`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { version?: string };
        if (!payload.version || cancelled) return;
        if (versionRef.current === null) {
          versionRef.current = payload.version;
          return;
        }
        if (versionRef.current !== payload.version) {
          versionRef.current = payload.version;
          scheduleRefresh();
        }
      } catch {
        // Polling is a fallback for missed realtime events; a transient failure is safe to ignore.
      }
    };

    void checkVersion();
    const pollId = window.setInterval(() => void checkVersion(), 2000);

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`claim-sync-${claimId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "claims", filter: `id=eq.${claimId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "claim_stage_details", filter: `claim_id=eq.${claimId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "claim_milestones", filter: `claim_id=eq.${claimId}` }, scheduleRefresh)
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };
    window.addEventListener("focus", checkVersion);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
      window.removeEventListener("focus", checkVersion);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [claimId, router]);

  return null;
}
