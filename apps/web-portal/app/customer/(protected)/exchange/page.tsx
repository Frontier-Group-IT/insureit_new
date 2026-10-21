import Link from "next/link";
import { Activity, BadgeCheck, Gauge, Heart, MapPin, Search, ShoppingBag, Store, Truck } from "lucide-react";
import {
  CustomerAccountTabs,
  EmptyCustomerState,
} from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  formatCustomerCompactMoney,
  loadCustomerExchangeActivity,
  loadCustomerExchangeFeed,
  loadCustomerExchangeSellableVehicles,
} from "@/lib/customer-web-phase3-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const categories = ["All", "Truck", "Tipper", "Pickup", "Bus", "Construction", "Other"] as const;
const tabs = ["buy", "sell", "activity"] as const;
type ExchangeTab = (typeof tabs)[number];

export default async function CustomerExchangePage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string; q?: string; category?: string; tab?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const category = categories.includes((params.category ?? "All") as (typeof categories)[number])
    ? (params.category ?? "All")
    : "All";
  const query = params.q?.trim() ?? "";
  const tab: ExchangeTab = tabs.includes((params.tab ?? "buy") as ExchangeTab)
    ? (params.tab as ExchangeTab)
    : "buy";

  let rows: Awaited<ReturnType<typeof loadCustomerExchangeFeed>> = [];
  let sellableVehicles: Awaited<ReturnType<typeof loadCustomerExchangeSellableVehicles>> = [];
  let activity: Awaited<ReturnType<typeof loadCustomerExchangeActivity>> = {
    favorites: [],
    bids: [],
    listings: [],
    deals: [],
    contact_requests: [],
  };
  let feedUnavailable = false;
  let sellUnavailable = false;
  let activityUnavailable = false;

  if (tab === "buy") {
    try {
      rows = await loadCustomerExchangeFeed({ category, query });
    } catch (error) {
      feedUnavailable = true;
      console.error("[customer-exchange-feed] Unable to load marketplace feed", {
        error: error instanceof Error ? error.message : "Unknown feed failure",
      });
    }
  }

  if (tab === "sell") {
    try {
      sellableVehicles = await loadCustomerExchangeSellableVehicles(account.id);
    } catch (error) {
      sellUnavailable = true;
      console.error("[customer-exchange-sell] Unable to load seller workspace", {
        error: error instanceof Error ? error.message : "Unknown seller workspace failure",
      });
    }
  }

  if (tab === "activity") {
    try {
      activity = await loadCustomerExchangeActivity(account.id);
    } catch (error) {
      activityUnavailable = true;
      console.error("[customer-exchange-activity] Unable to load activity", {
        error: error instanceof Error ? error.message : "Unknown activity failure",
      });
    }
  }

  const tabHref = (nextTab: ExchangeTab) => ({
    pathname: "/customer/exchange",
    query: { account: account.id, tab: nextTab },
  });

  return (
    <div className="space-y-5">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/exchange" />

      <section className="relative isolate overflow-hidden rounded-2xl border border-[#DCE6F2] bg-[#EAF4FF] px-5 py-6 shadow-[0_10px_28px_rgba(28,50,82,.05)] sm:px-7 sm:py-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url('/assets/PT.jpeg')] bg-cover bg-center opacity-95" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F7FBFF]/85 via-[#F7FBFF]/45 via-45% to-transparent" />
        <div className="relative z-10">
          <h1 className="text-[clamp(27px,3.5vw,40px)] font-black leading-tight text-[#10213D]">
            Vehicle <span className="text-[#267AFF]">Exchange</span>
          </h1>
          <p className="mt-2 text-[12px] leading-6 text-[#647995]">
            Buy, sell and track commercial vehicle Exchange activity from the same customer account.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 rounded-2xl border border-[#DCE4EE] bg-white p-2 shadow-[0_8px_24px_rgba(28,50,82,.04)]">
        <Link href={tabHref("buy")} className={tabClass(tab === "buy")}>
          <ShoppingBag className="h-4 w-4" /> Buy
        </Link>
        <Link href={tabHref("sell")} className={tabClass(tab === "sell")}>
          <Store className="h-4 w-4" /> Sell
        </Link>
        <Link href={tabHref("activity")} className={tabClass(tab === "activity")}>
          <Activity className="h-4 w-4" /> Activity
        </Link>
      </section>

      {tab === "buy" ? (
        <>
          <section className="space-y-3">
            <form className="flex w-full items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(28,50,82,.03)]">
              <Search className="h-4 w-4 shrink-0 text-[#73829A]" />
              <input type="hidden" name="account" value={account.id} />
              <input type="hidden" name="tab" value="buy" />
              {category !== "All" ? <input type="hidden" name="category" value={category} /> : null}
              <input
                name="q"
                defaultValue={query}
                placeholder="Search make, model, location or category"
                className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-[#10213D] outline-none placeholder:text-[#9AA6B7]"
              />
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
                      tab: "buy",
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
            <ExchangeRecovery accountId={account.id} tab="buy" query={query} category={category} />
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
        </>
      ) : null}

      {tab === "sell" ? (
        sellUnavailable ? (
          <ExchangeRecovery accountId={account.id} tab="sell" />
        ) : sellableVehicles.length === 0 ? (
          <EmptyCustomerState title="No vehicles available to sell" body="Vehicles linked to this customer account will appear here when eligible for Exchange." />
        ) : (
          <section className="space-y-3">
            <div>
              <h2 className="text-[18px] font-black text-[#10213D]">Sell from your Fleet</h2>
              <p className="mt-1 text-[10px] font-semibold text-[#71839A]">The same eligible fleet used by the Customer App Exchange seller journey.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sellableVehicles.map((vehicle) => (
                <div key={vehicle.vehicle_id} className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,.04)]">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EEF4FF]"><Truck className="h-6 w-6 text-[#3156B8]" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-black text-[#173A7D]">{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.vehicle_type}</p>
                      <p className="mt-1 text-[10px] font-bold text-[#6E7E94]">{vehicle.vehicle_no}</p>
                      <p className="mt-1 text-[9.5px] font-semibold text-[#8A97A9]">{[vehicle.city, vehicle.state].filter(Boolean).join(", ") || "Location on request"}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${vehicle.has_active_listing ? "bg-[#FFF4E5] text-[#B66B00]" : "bg-[#E9F8F0] text-[#0C7A52]"}`}>
                      {vehicle.has_active_listing ? "Already listed" : "Ready to list"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      ) : null}

      {tab === "activity" ? (
        activityUnavailable ? (
          <ExchangeRecovery accountId={account.id} tab="activity" />
        ) : (
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ActivityMetric icon={<Heart className="h-4 w-4" />} label="Saved" value={activity.favorites.length} />
              <ActivityMetric icon={<ShoppingBag className="h-4 w-4" />} label="Offers / Bids" value={activity.bids.length} />
              <ActivityMetric icon={<Store className="h-4 w-4" />} label="My Listings" value={activity.listings.length} />
              <ActivityMetric icon={<BadgeCheck className="h-4 w-4" />} label="Deals" value={activity.deals.length} />
              <ActivityMetric icon={<Activity className="h-4 w-4" />} label="Requests" value={activity.contact_requests.length} />
            </div>

            <ActivitySection title="My Listings" rows={activity.listings} />
            <ActivitySection title="Offers / Bids" rows={activity.bids} />
            <ActivitySection title="Deals" rows={activity.deals} />
            <ActivitySection title="Saved Vehicles" rows={activity.favorites} />
            <ActivitySection title="Contact Requests" rows={activity.contact_requests} />
          </section>
        )
      ) : null}
    </div>
  );
}

function tabClass(active: boolean) {
  return `flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[11px] font-black transition ${
    active ? "bg-[#173B68] text-white" : "text-[#63738A] hover:bg-[#F3F7FC]"
  }`;
}

function ExchangeRecovery({
  accountId,
  tab,
  query,
  category,
}: {
  accountId: string;
  tab: ExchangeTab;
  query?: string;
  category?: string;
}) {
  return (
    <section role="alert" className="rounded-2xl border border-[#DCE4EE] bg-white p-6 text-center shadow-sm">
      <h2 className="text-base font-extrabold text-[#172846]">Exchange data could not be loaded</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#64748B]">
        Your account and existing Exchange data are unchanged. Retry the current Exchange section.
      </p>
      <form action="/customer/exchange" method="get" className="mt-5">
        <input type="hidden" name="account" value={accountId} />
        <input type="hidden" name="tab" value={tab} />
        {query ? <input type="hidden" name="q" value={query} /> : null}
        {category && category !== "All" ? <input type="hidden" name="category" value={category} /> : null}
        <button type="submit" className="rounded-lg bg-[#173B68] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102F56]">
          Try Exchange again
        </button>
      </form>
    </section>
  );
}

function ActivityMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,.04)]">
      <div className="flex items-center gap-2 text-[#3156B8]">{icon}<span className="text-[10px] font-black">{label}</span></div>
      <p className="mt-2 text-[24px] font-black text-[#10213D]">{value.toLocaleString("en-IN")}</p>
    </div>
  );
}

function ActivitySection({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  if (!rows.length) return null;
  return (
    <div className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,.04)]">
      <h3 className="text-[13px] font-black text-[#10213D]">{title}</h3>
      <div className="mt-3 divide-y divide-[#E7EDF5]">
        {rows.slice(0, 20).map((row, index) => {
          const titleText = valueText(row.title) || valueText(row.listing_no) || valueText(row.deal_no) || valueText(row.request_type) || title;
          const status = valueText(row.status);
          const amount = Number(row.amount ?? row.agreed_price ?? row.asking_price ?? 0);
          return (
            <div key={valueText(row.listing_id) || valueText(row.deal_id) || valueText(row.bid_id) || valueText(row.request_id) || index} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-black text-[#173A7D]">{titleText}</p>
                {status ? <p className="mt-1 text-[9.5px] font-semibold capitalize text-[#7B899C]">{status.replaceAll("_", " ")}</p> : null}
              </div>
              {amount > 0 ? <p className="shrink-0 text-[11px] font-black text-[#10213D]">{formatCustomerCompactMoney(amount)}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function valueText(value: unknown) {
  return typeof value === "string" ? value : "";
}
