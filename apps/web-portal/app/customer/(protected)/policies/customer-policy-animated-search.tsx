"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

const SEARCH_HINTS = [
  "Search vehicles…",
  "Search policies…",
  "Search claims…",
  "Search customer records…",
] as const;

export function CustomerPolicyAnimatedSearch({
  accountId,
  query,
  status,
  source,
}: {
  accountId: string;
  query: string;
  status: string;
  source: string;
}) {
  const [value, setValue] = useState(query);
  const [hintIndex, setHintIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (value || reduceMotion) return;
    const timer = window.setInterval(() => setHintIndex((index) => index + 1), 3200);
    return () => window.clearInterval(timer);
  }, [value, reduceMotion]);

  const showingHint = value.length === 0;
  const currentHint = SEARCH_HINTS[hintIndex % SEARCH_HINTS.length];
  const previousHint = hintIndex > 0 ? SEARCH_HINTS[(hintIndex - 1) % SEARCH_HINTS.length] : null;

  return (
    <form
      role="search"
      action="/customer/policies"
      className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#D7E0EF] bg-[#FAFCFF] px-3 py-2.5 sm:min-w-[220px] sm:max-w-[400px] focus-within:border-[#B7CBEB]"
    >
      <Search className="h-4 w-4 shrink-0 text-[#8C9BB2]" aria-hidden="true" />
      <input type="hidden" name="account" value={accountId} />
      {status !== "all" && <input type="hidden" name="status" value={status} />}
      {source !== "all" && <input type="hidden" name="source" value={source} />}
      <div className="relative min-w-0 flex-1">
        <input
          type="search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Search policies"
          autoComplete="off"
          className="relative z-10 w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-[13px] text-[#203650] outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none"
        />
        {showingHint && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden text-[13px] leading-normal text-[#95A2B7]">
            {previousHint && !reduceMotion && (
              <span key={`previous-${hintIndex}`} className="policy-search-slide-out absolute inset-x-0 top-0 truncate">
                {previousHint}
              </span>
            )}
            <span key={`current-${hintIndex}`} className={`absolute inset-x-0 top-0 truncate ${hintIndex > 0 && !reduceMotion ? "policy-search-slide-in" : ""}`}>
              {currentHint}
            </span>
          </div>
        )}
      </div>
      <button type="submit" className="sr-only">Search</button>
      <style jsx>{`
        @keyframes policy-search-enter {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes policy-search-exit {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-100%); opacity: 0; }
        }
        .policy-search-slide-in { animation: policy-search-enter 400ms ease-in-out both; }
        .policy-search-slide-out { animation: policy-search-exit 400ms ease-in-out both; }
        @media (prefers-reduced-motion: reduce) {
          .policy-search-slide-in, .policy-search-slide-out { animation: none; }
        }
      `}</style>
    </form>
  );
}
