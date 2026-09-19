"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, X, XCircle } from "lucide-react";

export function AssociateAccountResultToast({
  tone,
  message,
  acknowledge = false,
}: {
  tone: "success" | "error";
  message: string;
  acknowledge?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("success");
    params.delete("error");
    params.delete("associate_error");
    params.delete("retry_after");
    const cleanUrl = params.size ? `${pathname}?${params.toString()}` : pathname;
    router.replace(cleanUrl, { scroll: false });

    if (acknowledge) return;

    const timer = window.setTimeout(() => setVisible(false), 3500);
    return () => window.clearTimeout(timer);
  }, [acknowledge, pathname, router, searchParams]);

  if (!visible) return null;

  const success = tone === "success";

  if (acknowledge && tone === "error") {
    return (
      <div
        className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/20 px-4 backdrop-blur-[1px]"
        role="presentation"
      >
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="associate-email-in-use-title"
          aria-describedby="associate-email-in-use-message"
          className="w-full max-w-[360px] rounded-2xl border border-[#E7ECF3] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.22)]"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-600">
              <AlertTriangle className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="associate-email-in-use-title" className="text-[13px] font-bold text-[#17203A]">
                Email Already in Use
              </h2>
              <p id="associate-email-in-use-message" className="mt-1.5 text-[10.5px] leading-5 text-[#5B667A]">
                {message}
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              autoFocus
              onClick={() => setVisible(false)}
              className="h-9 min-w-[76px] rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white transition hover:bg-[#102A4C] focus:outline-none focus:ring-2 focus:ring-[#C9D8EE]"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role={success ? "status" : "alert"
      aria-live={success ? "polite" : "assertive"}
      className="fixed right-4 top-4 z-[120] w-[min(92vw,390px)] animate-[associate-toast-in_180ms_ease-out] sm:right-6 sm:top-6"
    >
      <div
        className={`flex items-start gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-[0_18px_55px_rgba(15,23,42,0.18)] ${
          success ? "border-emerald-200" : "border-rose-200"
        }`}
      >
        <span
          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
            success ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          }`}
        >
          {success ? <CheckCircle2 className="h-4.5 w-4.5" /> : <XCircle className="h-4.5 w-4.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-bold ${
            success ? "text-emerald-700" : "text-rose-700"
          }`}>
            {success ? "Success" : "Unable to save"}
          </p>
          <p className="mt-0.5 text-[10.5px] leading-5 text-[#475569]">{message}</p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Dismiss notification"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#94A3B8] transition hover:bg-[#F1F5F9] hover:text-[#475569]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
