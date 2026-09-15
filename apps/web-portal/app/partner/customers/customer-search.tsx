"use client";

import { FormEvent, useCallback, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PartnerAutocompleteInput } from "@/components/partner-portal/partner-autocomplete-input";

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

  return (
    <form onSubmit={submit} className="w-full sm:max-w-[390px]" role="search">
      <PartnerAutocompleteInput
        scope="customers"
        name="q"
        value={value}
        onValueChange={setValue}
        placeholder="Search customer, code, trade name, mobile or city"
        ariaLabel="Search customers by name, code, trade name, mobile or city"
        inputClassName="h-10 w-full rounded-xl border border-[#D5DEEA] bg-white pl-10 pr-9 text-[10.5px] font-medium text-[#213653] outline-none transition placeholder:text-[#8796AA] focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
        searchIconClassName="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8594A8]"
        showClear
      />
      {isPending ? <span className="sr-only" aria-live="polite">Updating customer search results</span> : null}
    </form>
  );
}
