"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setExchangeListingVisibility } from "./actions";

export function ExchangeListingVisibilityAction({
  listingId, enabled,
}: { listingId: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [current, setCurrent] = useState(enabled);

  const onToggle = () => {
    const next = !current;
    setMessage(null);
    startTransition(async () => {
      try {
        await setExchangeListingVisibility(listingId, next);
        setCurrent(next);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update listing visibility.");
      }
    });
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={onToggle}
        aria-label={current ? "Disable listing in customer marketplace" : "Enable listing in customer marketplace"}
        title={current ? "Hide listing from customer marketplace" : "Show eligible listing in customer marketplace"}
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] font-black transition disabled:cursor-wait disabled:opacity-60 ${current ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
      >
        {pending ? "Saving…" : current ? "Disable" : "Enable"}
      </button>
      <span className="text-[9px] font-semibold text-[#738096]">{current ? "Enabled" : "Disabled"}</span>
      {message ? <p role="alert" className="max-w-40 text-[9px] font-semibold text-red-700">{message}</p> : null}
    </div>
  );
}
