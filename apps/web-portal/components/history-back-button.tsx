"use client";

import { useRouter } from "next/navigation";

export function HistoryBackButton({ fallbackHref = "/dashboard" }: { fallbackHref?: string }) {
  const router = useRouter();
  const hasExplicitDestination = fallbackHref !== "/dashboard";

  return (
    <button
      type="button"
      onClick={() => {
        if (hasExplicitDestination) {
          router.push(fallbackHref);
          return;
        }
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[#B7C5D8]/70 bg-white/38 text-lg text-[#17365F] shadow-sm backdrop-blur transition hover:border-[#8EA3BF] hover:bg-white/62"
      aria-label="Go back"
    >
      ‹
    </button>
  );
}
