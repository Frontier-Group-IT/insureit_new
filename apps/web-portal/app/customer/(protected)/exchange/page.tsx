import { CustomerAnimatedSearchInput } from "@/components/customer-portal/customer-animated-search-input";
import Link from "next/link";
import { BadgeCheck, Gauge, MapPin, Search, ShieldCheck, Truck } from "lucide-react";
import {
  CustomerAccountTabs,
  EmptyCustomerState,
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
  const category = categories.includes((params.category ?? "All") as (typeof categories)[number])
    ? (params.category ?? "All")
    : "All";
  const query = params.q?.trim() ?? "";

  let rows: Awaited<ReturnType<typeof loadCustomerExchangeFeed>> = [];
  let feedUnavailable = false;
  try {
    rows = await loadCustomerExchangeFeed({ category, query });
  } catch (error) {
    feedUnavailable = true;
    console.error("[customer-exchange-feed] Unable to load marketplace feed", {
      error: error instanceof Error ? error.message : "Unknown feed failure",
    });
  }

  return (
    <div className="space-y-5">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/exchange" />

      <section className="relative isolate overflow-hidden rounded-2xl border border-[#DCE6F2] bg-[#EAF4FF] px-5 py-6 shadow-[0_10px_28px_rgba(28,50,82,.05)] sm:px-7 sm:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url('/assets/PT.jpeg')] bg-cover bg-center opacity-95" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F7FBFF]/85 via-[#F7FBFF]/45 via-45% to-transparent" />
        <div className="relative z-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[720px]">
            <h1 className="text-[clamp(27px,3.5vw,40px)] font-black leading-tight text-[#10213D]">
              Vehicle <span className="text-[#267AFF]">Exchange</span>
            </h1>
            <p className="mt-2 text-[12px] leading-6 text-[#647995]">
              Browse commercial vehicles and find your next upgrade.
            </p>
          </div>

          <div className="inline-flex max-w-max items-center gap-2 rounded-full border border-[#D8E5F3] bg-white/85 px-3 py-2 text-[9.5px] font-bold text-[#61738D]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#267AFF]" />
            Transactions continue in the Customer App
          </div>
        </div>
        </div>
      </section>

      <section className="space-y-3">
        <form className="flex w-full items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(28,50,82,.03)]">
          <Search className="h-4 w-4 shrink-0 text-[#73829A]" />
          <input type="hidden" name="account" value={account.id} />
          {category !== "All" ? <input type="hidden" name="category" value={category} /> : null}
          <CustomerAnimatedSearchInput name="q" defaultValue={query} aria-label="Search exchange listings" hints={["Search manufacturer…", "Search model…", "Search location…", "Search category…"]} className="text-[12px] font-semibold text-[#10213D]"/>
          <button className="rounded-lg bg-[#142746] px-4 py-2 text-[10px] font-black text-white">Search</button>
        </form>

        <div className="flex flex-wrap gap-2">
          {categories.map((item) => (
            <Link
              key={item}
              href={{
                pathname: "/customer/exchange",
                query: {
                  account: account.id,
                  ...(query ? { q: query } : {}),
                  ...(item !== "All" ? { category: item } : {}),
                },
              }}
              className={`rounded-full border px-3.5 py-2 text-[10px] font-black transition ${
                category === item
                  ? "border-[#142746] bg-[#142746] text-white"
                  : "border-[#D8E1EC] bg-white text-[#64748B] hover:border-[#AFC5DE]"
              }`}
            >
              {item}
            </Link>
          ))}
        </div>
      </section>

      {feedUnavailable ? (
        <section role="alert" className="rounded-2xl border border-[#DCE4EE] bg-white p-6 text-center shadow-sm">
          <h2 className="text-base font-extrabold text-[#172846]">Exchange listings could not be loaded</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#64748B]">
            The marketplace is temporarily unavailable. Your account and existing data are unchanged.
            If retrying does not help, return to the Customer dashboard and try again later.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <form action="/customer/exchange" method="get">
              <input type="hidden" name="account" value={account.id} />
              {query ? <input type="hidden" name="q" value={query} /> : null}
              {category !== "All" ? <input type="hidden" name="category" value={category} /> : null}
              <button type="submit" className="rounded-lg bg-[#173B68] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102F56]">
                Try Exchange again
              </button>
            </form>
            <Link href="/customer/home" className="rounded-lg border border-[#CFD9E8] bg-white px-4 py-2.5 text-sm font-bold text-[#27415F] hover:bg-[#F6F9FD]">
              Back to dashboard
            </Link>
          </div>
        </section>
      ) : rows.length === 0 ? (
        <EmptyCustomerState title="No Exchange listings found" body="Try another category or search term." />
      ) : (
        <section>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-black text-[#10213D]">Available Vehicles</h2>
              <p className="mt-1 text-[10px] font-semibold text-[#71839A]">{rows.length} listing{rows.length === 1 ? "" : "s"} found</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => {
              const vehicleName = [row.make, row.model].filter(Boolean).join(" ") || row.title;
              const location = [row.city, row.state].filter(Boolean).join(", ") || "Location on request";
              const hasPrice = Number(row.asking_price || 0) > 0;
              return (
                <Link
                  key={row.listing_id}
                  href={{ pathname: `/customer/exchange/${row.listing_id}`, query: { account: account.id } }}
                  className="group overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,.04)] transition hover:-translate-y-0.5 hover:border-[#B9C9DB]"
                >
                  <div
                    className="relative h-44 overflow-hidden bg-[#EEF3F8] bg-cover bg-center"
                    style={row.cover_url ? { backgroundImage: `url("${row.cover_url}")` } : undefined}
                  >
                    {!row.cover_url ? (
                      <div className="absolute inset-0 grid place-items-center">
                        <Truck className="h-14 w-14 text-[#8D9AAD]" />
                      </div>
                    ) : null}

                    <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0B1D35]/70 to-transparent" />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-white/95 px-2.5 py-1 text-[9px] font-black text-[#31445F] shadow-sm">{row.category}</span>
                      {row.documents_verified || row.owner_verified ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F8F0]/95 px-2.5 py-1 text-[9px] font-black text-[#0C7A52] shadow-sm">
                          <BadgeCheck className="h-3 w-3" /> Verified
                        </span>
                      ) : null}
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-black">{vehicleName}</p>
                        <p className="mt-0.5 truncate text-[9.5px] font-bold text-white/80">{row.vehicle_type || row.masked_registration}</p>
                      </div>
                      <p className="shrink-0 text-[16px] font-black">
                        {hasPrice ? formatCustomerCompactMoney(Number(row.asking_price)) : "Price on request"}
                      </p>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#F7F9FC] p-3 text-[9.5px] font-bold text-[#65758C]">
                      <span className="inline-flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#267AFF]" /><span className="truncate">{location}</span></span>
                      <span className="inline-flex min-w-0 items-center gap-1.5"><Gauge className="h-3.5 w-3.5 shrink-0 text-[#267AFF]" /><span className="truncate">{row.odometer_km ? `${Number(row.odometer_km).toLocaleString("en-IN")} km` : "Usage unavailable"}</span></span>
                      <span>Year: <strong className="text-[#30445E]">{row.year || "—"}</strong></span>
                      <span>Mode: <strong className="capitalize text-[#30445E]">{row.selling_mode.replaceAll("_", " ")}</strong></span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[9.5px] font-bold text-[#71839A]">{row.inspected ? "Inspected listing" : "Inspection status pending"}</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-[#176BD4]">View details <span aria-hidden="true">→</span></span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
