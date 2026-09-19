"use client";

import { FormEvent, useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const SEARCH_DEBOUNCE_MS = 350;

export function CustomerSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();

  const currentQuery = searchParams.get("q")?.trim() ?? "";
  const serializedSearchParams = searchParams.toString();

  useEffect(() => {
    setValue(currentQuery);
  }, [currentQuery]);

  const replaceSearch = useCallback((nextValue: string) => {
    const normalized = nextValue.trim();
    if (normalized === currentQuery) return;

    const params = new URLSearchParams(serializedSearchParams);
    params.delete("page");

    if (normalized) params.set("q", normalized);
    else params.delete("q");

    const nextSearch = params.toString();
    startTransition(() => {
      router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, { scroll: false });
    });
  }, [currentQuery, pathname, router, serializedSearchParams]);

  useEffect(() => {
    const normalized = value.trim();
    if (normalized === currentQuery) return;

    const timer = window.setTimeout(() => {
      replaceSearch(value);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [currentQuery, replaceSearch, value]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    replaceSearch(value);
  };

  const clear = () => {
    setValue("");
    replaceSearch("");
  };

  return (
    <form onSubmit={submit} className="w-full sm:max-w-[390px]" role="search">
      <div className="relative min-w-0">
        {isPending ? <Loader2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#3156B8]" /> : <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8594A8]" />}
        <input
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Search customer, code, trade name, mobile or city"
          autoComplete="off"
          aria-label="Search customers by name, code, trade name, mobile or city"
          disabled={isPending}
          className="h-10 w-full rounded-xl border border-[#D5DEEA] bg-white pl-10 pr-9 text-[10.5px] font-medium text-[#213653] outline-none transition placeholder:text-[#8796AA] focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10 disabled:cursor-wait disabled:bg-[#F8FAFD] disabled:opacity-70"
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            disabled={isPending}
            aria-label="Clear customer search"
            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[#7D8DA4] transition hover:bg-[#EEF3F8] hover:text-[#3156B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 disabled:cursor-wait disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        {isPending ? <span className="sr-only" aria-live="polite">Updating customer search results</span> : null}
      </div>
    </form>
  );
}
