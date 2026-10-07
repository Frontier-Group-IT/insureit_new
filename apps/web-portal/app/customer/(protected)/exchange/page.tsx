import Link from "next/link";
import { BadgeCheck, Gauge, MapPin, Search, Truck } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  EmptyCustomerState,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  formatCustomerCompactMoney,
  loadCustomerExchangeFeed,
} from "@/lib/customer-web-phase3-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const categories = ["All", "Truck", "Tipper", "Pickup", "Bus", "Construction", "Other"] as const;

export default async function CustomerExchangePage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string; q?: string; category?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const category = categories.includes((params.category ?? "All") as (typeof categories)[number]) ? (params.category ?? "All") : "All";
  const query = params.q?.trim() ?? "";
  const rows = await loadCustomerExchangeFeed({ category, query });

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="Vehicle marketplace"
        title="Exchange"
        description="Browse verified commercial vehicle listings. Buying, bidding and selling actions remain in the Customer App during this web phase."
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/exchange" />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <form className="flex max-w-xl flex-1 items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5">
          <Search className="h-4 w-4 text-[#73829A]" />
          <input type="hidden" name="account" value={account.id} />
          {category !== "All" ? <input type="hidden" name="category" value={category} /> : null}
          <input
            name="q"
            defaultValue={query}
            placeholder="Search make, model, location or category"
            className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#10213D] outline-none placeholder:text-[#9AA6B7]"
          />
          <button className="rounded-lg bg-[#142746] px-3 py-1.5 text-[10px] font-black text-white">Search</button>
        </form>

        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <Link
              key={item}
              href={{ pathname: "/customer/exchange", query: { account: account.id, ...(query ? { q: query } : {}), ...(item !== "All" ? { category: item } : {}) } }}
              className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${category === item ? "border-[#142746] bg-[#142746] text-white" : "border-[#D8E1EC] bg-white text-[#64748B]"}`}
            >
              {item}
            </Link>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyCustomerState title="No Exchange listings found" body="Try another category or search term." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <Link
              key={row.listing_id}
              href={{ pathname: `/customer/exchange/${row.listing_id}`, query: { account: account.id } }}
              className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,0.04)] transition hover:-translate-y-0.5 hover:border-[#B9C9DB]"
            >
              <div className="flex h-32 items-center justify-center bg-[#F3F6FA]">
                <Truck className="h-12 w-12 text-[#8190A6]" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-black text-[#10213D]">{row.year ? `${row.year} ` : ""}{row.title}</p>
                    <p className="mt-1 truncate text-[10.5px] font-semibold text-[#74839A]">{row.masked_registration}</p>
                  </div>
                  {row.documents_verified ? <BadgeCheck className="h-5 w-5 shrink-0 text-[#0B7A54]" /> : null}
                </div>
                <p className="mt-3 text-[20px] font-black tracking-[-0.02em] text-[#10213D]">{formatCustomerCompactMoney(Number(row.asking_price || 0))}</p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] font-bold text-[#758399]">
                  <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{row.odometer_km ? `${Number(row.odometer_km).toLocaleString("en-IN")} km` : "Odometer verified"}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[row.city,row.state].filter(Boolean).join(", ") || "Location on request"}</span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <StatusPill tone={row.inspected ? "active" : "neutral"}>{row.inspected ? "Inspected" : "Inspection pending"}</StatusPill>
                  <span className="text-[9px] font-black uppercase tracking-[0.08em] text-[#718096]">{row.selling_mode.replaceAll("_"," ")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
