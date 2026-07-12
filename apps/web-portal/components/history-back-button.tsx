"use client";

import { useRouter } from "next/navigation";

export function HistoryBackButton({ fallbackHref = "/dashboard" }: { fallbackHref?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#E1E6EE] text-lg text-[#344054] transition hover:bg-[#F6F8FB]"
      aria-label="Go back"
    >
      ‹
    </button>
  );
}
