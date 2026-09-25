"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function VoiceCampaignRetryRowButton({
  campaignId,
  opportunityId,
  campaignStatus,
}: {
  campaignId: string;
  opportunityId: string;
  campaignStatus: string;
}) {
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      const response = await fetch(
        "/api/system/voice-integration/campaigns/" + campaignId + "/retry",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ opportunityId }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not prepare retry.");

      if (body.requeued && campaignStatus === "running") {
        await fetch(
          "/api/system/voice-integration/campaigns/" + campaignId + "/dispatch-batch",
          { method: "POST" },
        );
      }

      window.location.reload();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not retry this call.");
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void retry()}
      className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 text-[7.5px] font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
      title={campaignStatus === "paused" ? "Prepare this call for retry; resume campaign to queue it." : "Retry this busy or unanswered call"}
    >
      <RefreshCw className="h-3 w-3" />
      {busy ? "Retrying…" : "Retry"}
    </button>
  );
}
