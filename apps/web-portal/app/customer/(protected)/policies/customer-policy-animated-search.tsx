"use client";
import { CustomerSearchAutocomplete } from "@/components/customer-portal/customer-search-autocomplete";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";


export function CustomerPolicyAnimatedSearch({
  accountId,
  query,
  status,
  source,
  suggestions,
}: {
  accountId: string;
  query: string;
  status: string;
  source: string;
  suggestions: string[];
}) {
  const [value, setValue] = useState(query);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL-driven policy rows must refresh when the input is cleared, even
  // if the user deletes the characters manually instead of pressing Enter.
  useEffect(() => { setValue(query); }, [query]);
  function changeSearch(next: string) {
    setValue(next);
    if (next.trim() || !searchParams.has("q")) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("page");
    params.set("account", accountId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  return (
    <form
      role="search"
      action="/customer/policies"
      className="relative flex w-full min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#D7E0EF] bg-[#FAFCFF] px-2.5 py-1.5 sm:min-w-[180px] sm:max-w-[290px] focus-within:border-[#B7CBEB]"
    >
      <Search className="h-4 w-4 shrink-0 text-[#8C9BB2]" aria-hidden="true" />
      <input type="hidden" name="account" value={accountId} />
      {status !== "all" && <input type="hidden" name="status" value={status} />}
      {source !== "all" && <input type="hidden" name="source" value={source} />}
      <CustomerSearchAutocomplete name="q" value={value} onChange={changeSearch} options={suggestions} label="Search policies" hints={["Search policy number…", "Search insurer…", "Search vehicle number…", "Search policy product…"]} className="text-[13px] text-[#203650]"/>
      <button type="submit" className="sr-only">Search</button>
    </form>
  );
}
