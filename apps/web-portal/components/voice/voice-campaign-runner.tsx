"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, RefreshCw } from "lucide-react";

export function VoiceCampaignRunner({
  campaignId,
  status,
  autoEnrich = false,
  pendingDispatch,
  retryableFailures = 0,
}: {
  campaignId: string;
  status: string;
  autoEnrich?: boolean;
  pendingDispatch: number;
  retryableFailures?: number;
}) {
  const autoStarted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function enrichAll() {
    setBusy(true);
    setMessage("Fetching RC and insurance details…");
    try {
      for (let index = 0; index < 25; index += 1) {
        const response = await fetch(
          "/api/system/voice-integration/campaigns/" + campaignId + "/enrich",
          { method: "POST" },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Enrichment failed.");

        setMessage(
          body.done
            ? "Enrichment complete · " + body.readyTotal + " ready"
            : "Fetching details · " + body.remaining + " remaining",
        );

        if (body.done) {
          window.location.assign("/system/voice-integration/campaigns/" + campaignId);
          return;
        }
      }
      throw new Error("Enrichment did not finish within the expected batch limit.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enrichment failed.");
      setBusy(false);
    }
  }

  async function dispatchAll() {
    setBusy(true);
    setMessage("Queueing ready customers…");

    try {
      for (let index = 0; index < 40; index += 1) {
        const response = await fetch(
          "/api/system/voice-integration/campaigns/" + campaignId + "/dispatch-batch",
          { method: "POST" },
        );
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Campaign dispatch stopped.");

        setMessage(
          body.done
            ? "Queueing complete · " + body.queuedTotal + " queued"
            : "Queueing calls · " + body.remaining + " remaining",
        );

        if (body.done) {
          window.location.reload();
          return;
        }
      }
      throw new Error("Campaign dispatch exceeded the expected batch limit.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign dispatch stopped.");
      setBusy(false);
    }
  }

  async function retryBusyOrUnanswered() {
    if (
      !window.confirm(
        "Retry " + retryableFailures + " failed call" + (retryableFailures === 1 ? "" : "s") + " where the number was busy or unanswered?",
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage("Preparing retry calls…");

    try {
      const response = await fetch(
        "/api/system/voice-integration/campaigns/" + campaignId + "/retry",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not prepare retry calls.");

      if (!body.requeued) {
        setMessage("No busy or unanswered calls are currently eligible for retry.");
        setBusy(false);
        return;
      }

      if (status === "running") {
        setMessage(body.requeued + " call" + (body.requeued === 1 ? "" : "s") + " ready to retry · queueing now…");
        await dispatchAll();
        return;
      }

      setMessage(
        body.requeued +
          " call" +
          (body.requeued === 1 ? "" : "s") +
          " ready to retry · Resume campaign to queue them.",
      );
      setBusy(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare retry calls.");
      setBusy(false);
    }
  }

  async function changeStatus(action: "start" | "pause" | "resume") {
    if (
      action === "start" &&
      !window.confirm("Start this campaign and queue up to " + pendingDispatch + " ready customer calls?")
    ) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        "/api/system/voice-integration/campaigns/" + campaignId + "/status",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Campaign update failed.");

      if (action === "pause") {
        window.location.reload();
        return;
      }

      await dispatchAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign update failed.");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoEnrich && status === "enriching" && !autoStarted.current) {
      autoStarted.current = true;
      void enrichAll();
    }
  }, [autoEnrich, status]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {message ? (
        <span className="mr-auto text-[8.5px] font-semibold text-[#61758F]">{message}</span>
      ) : null}

      {retryableFailures > 0 && ["running", "paused"].includes(status) ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void retryBusyOrUnanswered()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 text-[8.5px] font-bold text-amber-800 disabled:opacity-50"
        >
          <RefreshCw className="h-3 w-3" />
          Retry busy / unanswered ({retryableFailures})
        </button>
      ) : null}

      {status === "enriching" || status === "needs_review" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void enrichAll()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D6E0EC] bg-white px-3 text-[8.5px] font-bold text-[#3156B8] disabled:opacity-50"
        >
          <RefreshCw className="h-3 w-3" />
          Fetch details
        </button>
      ) : null}

      {(status === "ready" || status === "needs_review") && pendingDispatch > 0 ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void changeStatus("start")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#102A56] px-3 text-[8.5px] font-bold text-white disabled:opacity-50"
        >
          <Play className="h-3 w-3" />
          Start campaign
        </button>
      ) : null}

      {status === "running" ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => void dispatchAll()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#102A56] px-3 text-[8.5px] font-bold text-white disabled:opacity-50"
          >
            <Play className="h-3 w-3" />
            Continue queueing
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void changeStatus("pause")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D6E0EC] bg-white px-3 text-[8.5px] font-bold text-[#52667F] disabled:opacity-50"
          >
            <Pause className="h-3 w-3" />
            Pause queueing
          </button>
        </>
      ) : null}

      {status === "paused" ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void changeStatus("resume")}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#102A56] px-3 text-[8.5px] font-bold text-white disabled:opacity-50"
        >
          <Play className="h-3 w-3" />
          Resume campaign
        </button>
      ) : null}
    </div>
  );
}
