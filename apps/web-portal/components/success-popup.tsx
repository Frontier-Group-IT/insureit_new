"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const successMessages: Record<string, { title: string; message: string }> = {
  customer_created: {
    title: "Customer onboarded",
    message: "The new customer profile has been created successfully."
  },
  customer_updated: {
    title: "Customer updated",
    message: "The customer profile changes have been saved successfully."
  },
  documents_uploaded: {
    title: "Documents uploaded",
    message: "The customer documents have been uploaded and saved successfully."
  }
};

function SuccessPopupInner() {
  const searchParams = useSearchParams();
  const successKey = searchParams.get("success");
  const popup = useMemo(() => successKey ? successMessages[successKey] ?? null : null, [successKey]);
  const [open, setOpen] = useState(Boolean(popup));

  useEffect(() => {
    if (!popup) return;
    setOpen(true);

    const url = new URL(window.location.href);
    url.searchParams.delete("success");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);

    const timeout = window.setTimeout(() => setOpen(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [popup]);

  if (!popup || !open) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center bg-[#0F172A]/18 px-4 pt-20 backdrop-blur-[1px]" role="status" aria-live="polite">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <div className="flex items-start gap-3 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">✓</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-[#0F172A]">{popup.title}</h2>
            <p className="mt-1 text-[11px] leading-5 text-[#64748B]">{popup.message}</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[16px] text-[#64748B] hover:bg-[#F1F5F9]" aria-label="Close success message">×</button>
        </div>
        <div className="h-1 w-full bg-emerald-500" />
      </div>
    </div>
  );
}

export function SuccessPopup() {
  return (
    <Suspense fallback={null}>
      <SuccessPopupInner />
    </Suspense>
  );
}
