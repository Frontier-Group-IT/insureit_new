"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SEARCH_DEBOUNCE_MS = 350;

export function CustomerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q")?.trim() ?? "";

  useEffect(() => {
    setValue(currentQuery);
  }, [currentQuery]);

  const replaceSearch = (nextValue: string) => {
    const normalized = nextValue.trim();
    if (normalized === currentQuery) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");

    if (normalized) params.set("q", normalized);
    else params.delete("q");

    const nextSearch = params.toString();
    startTransition(() => {
      router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, { scroll: false });
    });
  };

  useEffect(() => {
    const normalized = value.trim();
    if (normalized === currentQuery) return;

    const timer = window.setTimeout(() => {
      replaceSearch(value);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [currentQuery, value]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    replaceSearch(value);
  };

  const clear = () => {
    setValue("");
    replaceSearch("");
  };

  return (
    <form onSubmit={submit} className="w-full sm:max-w-[430px]" role="search">
      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7D8DA4]" />
        <input
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search name, code, phone or email"
          autoComplete="off"
          aria-label="Search customers by name, code, phone or email"
          className="h-9 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-9 text-[10px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear customer search"
            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[#7D8DA4] transition hover:bg-[#EEF3F8] hover:text-[#3156B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {isPending ? <span className="sr-only" aria-live="polite">Updating customer search results</span> : null}
      </div>
    </form>
  );
}
