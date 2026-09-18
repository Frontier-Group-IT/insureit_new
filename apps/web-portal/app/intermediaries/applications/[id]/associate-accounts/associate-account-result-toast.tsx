"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, X, XCircle } from "lucide-react";

export function AssociateAccountResultToast({
  tone,
  message,
}: {
  tone: "success" | "error";
  message: string;
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

    const timer = window.setTimeout(() => setVisible(false), 3500);
    return () => window.clearTimeout(timer);
  }, [pathname, router, searchParams]);

  if (!visible) return null;

  const success = tone === "success";

  return (
    <div
      role={success ? "status" : "alert"}
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
