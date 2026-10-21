import { CustomerAnimatedSearchInput } from "@/components/customer-portal/customer-animated-search-input";
"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function CustomerClaimsSearch({ initialQuery, accountId, type }: { initialQuery: string; accountId: string; type: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQuery = params.get("q") ?? "";
  useEffect(() => { setQuery(urlQuery); }, [urlQuery]);
  useEffect(() => {
    if (query === urlQuery) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      next.set("account", accountId);
      next.set("type", type);
      if (query.trim()) next.set("q", query.trim()); else next.delete("q");
      next.delete("page");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, urlQuery, params, accountId, type, pathname, router]);
  return <label className="flex w-full min-w-0 flex-1 items-center gap-2 rounded-lg border sm:min-w-[220px] sm:max-w-[400px] border-[#D8E1EC] bg-white px-3 py-2.5 transition-colors focus-within:border-[#4E95E9]">
    <Search className="h-4 w-4 shrink-0 text-[#71829A]" aria-hidden="true"/>
    <span className="sr-only">Search claims</span>
    <CustomerAnimatedSearchInput value={query} onChange={e => setQuery(e.target.value)} aria-label="Search claims" aria-busy={pending} hints={["Search claim number…", "Search vehicle number…", "Search claim status…"]} className="text-[11px] text-[#263B59]"/>

  </label>;
}

export function CustomerClaimsStageFilter({ value, stages, accountId, type, query }: { value: string; stages: string[]; accountId: string; type: string; query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return <select aria-label="Filter claim stage" value={value} onChange={event => {
    const next = new URLSearchParams(params.toString());
    next.set("account", accountId);
    next.set("type", type);
    if (query) next.set("q", query); else next.delete("q");
    if (event.target.value) next.set("stage", event.target.value); else next.delete("stage");
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }} className="max-w-[210px] rounded-lg border border-[#CBD8E9] bg-white px-3 py-2.5 text-[11px] text-[#142746]">
    <option value="">All claim stages</option>
    {stages.map(stage => <option key={stage} value={stage}>{stage}</option>)}
  </select>;
}
