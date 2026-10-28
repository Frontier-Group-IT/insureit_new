import "./customer-exchange-premium.css";
import "../customer-register-motion.css";
import { CustomerAnimatedSearchInput } from "@/components/customer-portal/customer-animated-search-input";
import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, BadgeCheck, Heart, Search, ShoppingBag, Store, Truck } from "lucide-react";
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
  const requestedTab = params.tab ?? "buy";
  const tab: ExchangeTab = tabs.includes(requestedTab as ExchangeTab)
    ? (requestedTab as ExchangeTab)
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
    <div className="customer-register-motion customer-exchange-premium space-y-5">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/exchange" />

      <section className="exchange-premium-hero customer-register-hero relative isolate overflow-hidden rounded-2xl border border-[#DCE6F2] bg-[#EAF4FF] px-5 py-6 shadow-[0_10px_28px_rgba(28,50,82,.05)] sm:px-7 sm:py-7">
        <div aria-hidden="true" className="exchange-premium-hero-art pointer-events-none absolute inset-0 bg-[url('/assets/PT.jpeg')] bg-cover bg-center opacity-95" />
        <div aria-hidden="true" className="exchange-premium-hero-shade pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F7FBFF]/85 via-[#F7FBFF]/45 via-45% to-transparent" />
        <div className="relative z-10 max-w-[650px]">
          <h1 className="text-[clamp(27px,3.5vw,40px)] font-black leading-tight text-[#10213D]">
            Vehicle <span className="text-[#267AFF]">Exchange</span>
          </h1>
          <p className="mt-2 text-[12px] leading-6 text-[#647995]">
            Buy, sell and track commercial vehicle Exchange activity from the same customer account.
          </p>
        </div>
      </section>

      <section className="exchange-premium-tabs customer-register-panel grid grid-cols-3 gap-2 rounded-2xl border border-[#DCE4EE] bg-white p-2 shadow-[0_8px_24px_rgba(28,50,82,.04)]">
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
          <section className="exchange-premium-search-section space-y-3">
            <form className="exchange-premium-search customer-register-control flex w-full items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(28,50,82,.03)]">
              <Search className="h-4 w-4 shrink-0 text-[#73829A]" />
              <input type="hidden" name="account" value={account.id} />
              <input type="hidden" name="tab" value="buy" />
              {category !== "All" ? <input type="hidden" name="category" value={category} /> : null}
              <CustomerAnimatedSearchInput name="q" defaultValue={query} aria-label="Search exchange listings" hints={["Search manufacturer…", "Search model…", "Search location…", "Search category…"]} className="text-[12px] font-semibold text-[#10213D]"/>
              <button className="customer-register-action rounded-lg bg-[#142746] px-4 py-2 text-[10px] font-black text-white">Search</button>
            </form>

            <div className="exchange-premium-categories flex flex-wrap gap-2">
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
                  className={`customer-register-filter rounded-full border px-3.5 py-2 text-[10px] font-black transition ${
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
            <section className="exchange-premium-listings">
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-black text-[#10213D]">Available Vehicles</h2>
                  <p className="mt-1 text-[10px] font-semibold text-[#71839A]">{rows.length} listing{rows.length === 1 ? "" : "s"} found</p>
                </div>
              </div>

              <div className="exchange-premium-table-wrap overflow-x-auto rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,.04)]">
                <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
                  <thead className="border-b border-[#E8ECF2] bg-[#F8FAFC] text-[9px] font-black uppercase tracking-[.09em] text-[#6C778C]">
                    <tr>
                      <th scope="col" className="w-[32%] px-5 py-4">Listing / Vehicle</th>
                      <th scope="col" className="w-[14%] px-4 py-4">Location</th>
                      <th scope="col" className="w-[16%] px-4 py-4">Commercials</th>
                      <th scope="col" className="w-[19%] px-4 py-4">Evidence</th>
                      <th scope="col" className="w-[12%] px-4 py-4">Verification</th>
                      <th scope="col" className="w-[7%] px-3 py-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8EDF5]">
                    {rows.map((row) => {
                      const vehicleName = [row.make, row.model].filter(Boolean).join(" ") || row.title;
                      const location = [row.city, row.state].filter(Boolean).join(", ") || "Location on request";
                      const hasPrice = Number(row.asking_price || 0) > 0;
                      const href = { pathname: `/customer/exchange/${row.listing_id}`, query: { account: account.id } };
                      return (
                        <tr key={row.listing_id} className="exchange-premium-listing customer-register-row group transition-colors hover:bg-[#FBFCFE]">
                          <td className="px-5 py-4 align-top">
                            <div className="flex min-w-0 items-start gap-3">
                              <Link href={href} className="customer-register-image grid h-[75px] w-[88px] shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E1E8F2] bg-[#EEF3F8]">
                                {row.cover_url ? <img src={row.cover_url} alt={vehicleName} className="h-full w-full object-cover" /> : <Truck className="h-8 w-8 text-[#8295B0]" />}
                              </Link>
                              <div className="min-w-0 pt-0.5">
                                <div className="flex items-center gap-2">
                                  <Link href={href} className="truncate text-[12px] font-black text-[#173A7D] hover:underline">{row.listing_no}</Link>
                                  <span className="exchange-premium-live shrink-0 rounded-full bg-[#E7F7EF] px-2 py-0.5 text-[9px] font-black text-[#087A4B]">LIVE</span>
                                </div>
                                <Link href={href} className="mt-1 block truncate text-[12px] font-extrabold text-[#273752] hover:text-[#176BD4]">{vehicleName}</Link>
                                <p className="mt-1 truncate text-[10px] font-semibold text-[#72819B]">{row.masked_registration} · {row.year || "—"} · {row.category}</p>
                                <p className="mt-1 truncate text-[9.5px] text-[#8291A8]">{row.vehicle_type || "Commercial vehicle"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <p className="text-[11px] font-bold text-[#34435C]">{location}</p>
                            <p className="mt-1 text-[10px] text-[#7A899F]">{row.odometer_km != null ? `${Number(row.odometer_km).toLocaleString("en-IN")} km` : "Mileage unavailable"}</p>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <p className="text-[14px] font-black text-[#182B4B]">{hasPrice ? formatCustomerCompactMoney(Number(row.asking_price)) : "On request"}</p>
                            <p className="mt-1 text-[9px] font-bold uppercase text-[#7687A0]">{row.selling_mode.replaceAll("_", " ")}</p>
                            {row.bid_count > 0 ? <p className="mt-2 text-[10px] font-semibold text-[#59749A]">{row.bid_count} offer{row.bid_count === 1 ? "" : "s"}</p> : null}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <div className="customer-register-image grid h-12 w-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#E1E8F2] bg-[#F1F5FA]">
                                {row.cover_url ? <img src={row.cover_url} alt="Listing cover" className="h-full w-full object-cover" /> : <Truck className="h-5 w-5 text-[#8C9BB0]" />}
                              </div>
                              <span className="text-[10px] font-semibold text-[#70819A]">Vehicle image</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.owner_verified ? "bg-[#E7F8F0] text-[#0B8456]" : "bg-[#F2F4F7] text-[#8994A5]"}`}>{row.owner_verified ? "●" : "○"} Owner</span>
                              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.documents_verified ? "bg-[#E7F8F0] text-[#0B8456]" : "bg-[#F2F4F7] text-[#8994A5]"}`}>{row.documents_verified ? "●" : "○"} Docs</span>
                              <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.inspected ? "bg-[#E7F8F0] text-[#0B8456]" : "bg-[#F2F4F7] text-[#8994A5]"}`}>{row.inspected ? "●" : "○"} Inspection</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <span className={`exchange-premium-verification inline-flex items-center gap-1 text-[10px] font-bold ${row.owner_verified && row.documents_verified ? "text-[#13805C]" : "text-[#73839B]"}`}>
                              <BadgeCheck className="h-4 w-4" />
                              {row.owner_verified && row.documents_verified ? "Verified" : "Review pending"}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-center align-top">
                            <Link href={href} aria-label={`View listing ${row.listing_no}`} className="customer-register-action inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#D8E2F0] text-lg font-extrabold text-[#1C3B72] transition hover:bg-[#E9F2FF]">⋮</Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
          <section className="exchange-premium-sell space-y-3">
            <div>
              <h2 className="text-[18px] font-black text-[#10213D]">Sell from your Fleet</h2>
              <p className="mt-1 text-[10px] font-semibold text-[#71839A]">The same eligible fleet used by the Customer App Exchange seller journey.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sellableVehicles.map((vehicle) => (
                <div key={vehicle.vehicle_id} className="customer-register-card rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,.04)]">
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
          <section className="exchange-premium-activity space-y-4">
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
  return `exchange-premium-tab flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[11px] font-black transition ${
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

function ActivityMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="exchange-premium-activity-card rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,.04)]">
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
