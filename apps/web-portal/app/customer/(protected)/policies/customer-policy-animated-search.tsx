"use client";
import { CustomerAnimatedSearchInput } from "@/components/customer-portal/customer-animated-search-input";

import { Search } from "lucide-react";
import { useState } from "react";


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
      <CustomerAnimatedSearchInput name="q" value={value} onChange={event => setValue(event.target.value)} aria-label="Search policies" autoComplete="off" hints={["Search policy number…", "Search insurer…", "Search vehicle number…", "Search policy product…"]} className="text-[13px] text-[#203650]"/>
      <button type="submit" className="sr-only">Search</button>
    </form>
  );
}
