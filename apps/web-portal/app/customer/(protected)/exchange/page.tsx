import "./customer-exchange-reference.css";
import "./customer-exchange-premium.css";
import "../customer-register-motion.css";
import { CustomerAnimatedSearchInput } from "@/components/customer-portal/customer-animated-search-input";
import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowLeftRight, BadgeCheck, Heart, MapPin, MoreVertical, Search, ShoppingBag, Store, Truck } from "lucide-react";
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
    <div className="customer-register-motion customer-exchange-premium exchange-reference space-y-3">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/exchange" />

      <section className="exchange-premium-hero customer-register-hero relative isolate overflow-hidden rounded-2xl border border-[#DCE6F2] bg-[#EAF4FF] px-5 py-6 shadow-[0_10px_28px_rgba(28,50,82,.05)] sm:px-7 sm:py-7">
        <div aria-hidden="true" className="exchange-premium-hero-art pointer-events-none absolute inset-0 bg-[url('/assets/PT.jpeg')] bg-cover bg-center opacity-95" />
        <div aria-hidden="true" className="exchange-premium-hero-shade pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F7FBFF]/85 via-[#F7FBFF]/45 via-45% to-transparent" />
        <div className="relative z-10 max-w-[650px]">
          <div className="flex items-center gap-3"><span className="exchange-reference-hero-icon grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E8E5FF] text-[#6950E8]"><ArrowLeftRight className="h-7 w-7" /></span><div><h1 className="text-[clamp(25px,3vw,34px)] font-black leading-tight text-[#15234A]">
            Vehicle <span className="exchange-reference-gradient-text">Exchange</span>
          </h1>
          <p className="mt-2 text-[12px] leading-6 text-[#647995]">
            Buy, sell and track commercial vehicle Exchange activity from the same customer account.
          </p></div></div>
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
            <div className="exchange-reference-controls flex flex-wrap items-center gap-2">
              <form className="exchange-premium-search customer-register-control flex min-w-[180px] flex-[2] items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2 shadow-sm">
                <Search className="h-4 w-4 shrink-0 text-[#73829A]" />
                <input type="hidden" name="account" value={account.id} />
                <input type="hidden" name="tab" value="buy" />
                {category !== "All" ? <input type="hidden" name="category" value={category} /> : null}
                <CustomerAnimatedSearchInput name="q" defaultValue={query} aria-label="Search exchange listings" hints={["Search model, vehicle, brand…", "Search location…", "Search category…"]} className="text-[12px] font-semibold text-[#10213D]"/>
                <button className="exchange-reference-search-button customer-register-action inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#6255EE] px-4 py-2 text-[11px] font-bold text-white"><Search className="h-3.5 w-3.5"/>Search</button>
              </form>
              <div className="exchange-premium-categories flex flex-wrap items-center gap-1.5">
                {categories.map(item => <Link key={item} href={{pathname:"/customer/exchange",query:{account:account.id,tab:"buy",...(query?{q:query}:{}),...(item!=="All"?{category:item}:{})}}} aria-current={category===item?"page":undefined} className={`exchange-reference-category inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-bold ${category===item?"border-[#142746] bg-[#142746] text-white":"border-[#E0E6F2] bg-white text-[#63738B]"}`}>
                  {item==="Truck"||item==="Tipper"||item==="Pickup"||item==="Bus" ? <Truck className="h-3.5 w-3.5"/> : null}{item}
                </Link>)}
              </div>
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

              <div className="exchange-reference-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {rows.map(row => {
                  const vehicleName=[row.make,row.model].filter(Boolean).join(" ")||row.title;
                  const location=[row.city,row.state].filter(Boolean).join(", ")||"Location on request";
                  const hasPrice=Number(row.asking_price||0)>0;
                  const href={pathname:`/customer/exchange/${row.listing_id}`,query:{account:account.id}};
                  const verified=row.owner_verified&&row.documents_verified;
                  return <article key={row.listing_id} className="exchange-reference-card group min-w-0 overflow-hidden rounded-xl border border-[#DEE6F5] bg-white p-2 shadow-[0_5px_18px_rgba(34,70,120,.06)]">
                    <div className="relative h-[104px] overflow-hidden rounded-lg bg-[#EAF1FA]">
                      <Link href={href} aria-label={`View ${vehicleName}`} className="block h-full w-full">
                        {row.cover_url?<img src={row.cover_url} alt={vehicleName} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]"/>:<div className="flex h-full items-center justify-center bg-gradient-to-br from-[#EDF3FC] to-[#D4E4FA]"><Truck className="h-12 w-12 text-[#6583B0]"/></div>}
                      </Link>
                      <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[9px] font-extrabold text-white ${verified?"bg-[#15966D]":"bg-[#7460E8]"}`}>{verified?"● VERIFIED":"● LIVE"}</span>
                      <Link href={href} aria-label={`Open listing ${row.listing_no}`} className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[#7163C5] shadow-sm"><Heart className="h-3.5 w-3.5"/></Link>
                    </div>
                    <div className="px-1 pb-1 pt-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><Link href={href} className="block truncate text-[11px] font-extrabold text-[#173A7D]">{row.listing_no}</Link><Link href={href} title={vehicleName} className="mt-1 block truncate text-[11px] font-bold text-[#263758]">{vehicleName}</Link></div>
                        <div className="shrink-0 text-right"><p className="text-[13px] font-black text-[#162E57]">{hasPrice?formatCustomerCompactMoney(Number(row.asking_price)):"On request"}</p><p className="mt-1 text-[8px] font-bold uppercase text-[#8796AB]">{row.selling_mode.replaceAll("_"," ")}</p></div>
                      </div>
                      <p className="mt-1 truncate text-[9px] text-[#8490AB]">{row.masked_registration} · {row.year||"—"} · {row.category}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-[#637995]">
                        <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0"/>{location}</span>
                        <span className="shrink-0 text-[#6955D8]">{row.bid_count} offer{row.bid_count===1?"":"s"}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-[9px] text-[#8390A6]"><Truck className="h-3 w-3"/>{row.odometer_km!=null?`${Number(row.odometer_km).toLocaleString("en-IN")} km`:"Mileage unavailable"}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[#EDF0F7] pt-2">
                        <span className={`rounded-full px-1.5 py-1 text-[8px] font-semibold ${row.owner_verified?"bg-[#E4F8EC] text-[#17815B]":"bg-[#F2F4F9] text-[#8391A7]"}`}>● Owner</span>
                        <span className={`rounded-full px-1.5 py-1 text-[8px] font-semibold ${row.documents_verified?"bg-[#E4F8EC] text-[#17815B]":"bg-[#F2F4F9] text-[#8391A7]"}`}>● Docs</span>
                        <span className={`rounded-full px-1.5 py-1 text-[8px] font-semibold ${row.inspected?"bg-[#E4F8EC] text-[#17815B]":"bg-[#F2F4F9] text-[#8391A7]"}`}>● Inspection</span>
                        <Link href={href} aria-label={`View listing ${row.listing_no}`} className="ml-auto grid h-7 w-7 place-items-center rounded-lg border border-[#E0E7F4] text-[#244A87] hover:bg-[#EFF4FF]"><MoreVertical className="h-4 w-4"/></Link>
                      </div>
                    </div>
                  </article>;
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
