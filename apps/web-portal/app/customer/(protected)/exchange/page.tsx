import "./customer-exchange-reference.css";
import "./customer-exchange-premium.css";
import "../customer-register-motion.css";
import { CustomerAnimatedSearchInput } from "@/components/customer-portal/customer-animated-search-input";
import Link from "next/link";
import { CustomerExchangeSellWorkspace } from "@/components/customer-portal/customer-exchange-sell-workspace";
import { Activity, Heart, ArrowLeftRight, BadgeCheck, MapPin, MoreVertical, Search, ShoppingBag, Store, Truck, ChevronRight, Clock3, ShieldCheck } from "lucide-react";
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
  searchParams?: Promise<{ account?: string; q?: string; category?: string; tab?: string; activityFilter?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const category = categories.includes((params.category ?? "All") as (typeof categories)[number])
    ? (params.category ?? "All")
    : "All";
  const query = params.q?.trim() ?? "";
  const activityFilters = ["all", "offers", "bids", "listings", "deals", "requests", "saved"] as const;
  const activityFilter = activityFilters.includes(params.activityFilter as typeof activityFilters[number]) ? params.activityFilter! : "all";
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

      <section className={`${tab === "sell" ? "exchange-sell-hero" : ""} exchange-premium-hero customer-register-hero relative isolate overflow-hidden rounded-2xl border border-[#DCE6F2] bg-[#EAF4FF] px-5 py-6 shadow-[0_10px_28px_rgba(28,50,82,.05)] sm:px-7 sm:py-7`}>
        <div aria-hidden="true" className={`exchange-premium-hero-art pointer-events-none absolute inset-0 bg-cover bg-center opacity-95 bg-[url('/assets/Exchange.jpeg')]`} />
        <div aria-hidden="true" className={`exchange-premium-hero-shade pointer-events-none absolute inset-0 ${tab === "sell" ? "bg-gradient-to-r from-[#0C315C]/95 via-[#133E6C]/80 to-[#133E6C]/5" : "bg-gradient-to-r from-[#F7FBFF]/85 via-[#F7FBFF]/45 via-45% to-transparent"}`} />
        <div className="relative z-10 max-w-[650px]">
          {tab === "sell" ? <div className="space-y-2"><p className="text-[10px] font-extrabold uppercase tracking-widest text-[#B7D8FB]">InsureIt Exchange</p><h1 className="text-[clamp(23px,3vw,32px)] font-black text-white">Sell Your Commercial Vehicle</h1><p className="text-[12px] text-[#DBE8FA]">Turn your existing vehicle into new opportunities.</p><div className="flex flex-wrap gap-x-6 gap-y-2 pt-3 text-[10px] font-semibold text-white"><span>✓ List Easily</span><span>✓ Reach Buyers</span><span>✓ Trusted Platform</span></div></div> : <div className="flex items-center gap-3"><span className="exchange-reference-hero-icon grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E8E5FF] text-[#6950E8]"><ArrowLeftRight className="h-7 w-7" /></span><div><h1 className="text-[clamp(25px,3vw,34px)] font-black leading-tight text-[#15234A]">
            Vehicle <span className="exchange-reference-gradient-text">Exchange</span>
          </h1>
          </div></div>}
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
        sellUnavailable ? <ExchangeRecovery accountId={account.id} tab="sell" /> :
        <CustomerExchangeSellWorkspace accountId={account.id} vehicles={sellableVehicles} />
      ) : null}

      {tab === "activity" ? (
        activityUnavailable ? (
          <ExchangeRecovery accountId={account.id} tab="activity" />
        ) : (
          <section className="exchange-premium-activity space-y-4">
            <div className="rounded-2xl border border-[#DEE6F3] bg-white p-3 shadow-[0_8px_28px_rgba(27,50,88,.045)] sm:p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[17px] font-extrabold text-[#11254B]">Your Activity</h2>
                <details className="group relative">
                  <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-[#E7ECF7] bg-[#F4F7FD] px-3 py-2.5 text-[11px] font-bold text-[#123967] [&::-webkit-details-marker]:hidden">
                    <span>Filter: {({all:"All",offers:"Offers",bids:"Bids",listings:"Listings",deals:"Deals",requests:"Requests",saved:"Saved"} as Record<string,string>)[activityFilter]}</span>
                    <span aria-hidden="true">⌄</span>
                  </summary>
                  <nav aria-label="Exchange activity filters" className="absolute right-0 z-30 mt-2 min-w-[175px] rounded-xl border border-[#DCE4EE] bg-white p-1 shadow-lg">
                    {([["all","All",activity.bids.length+activity.listings.length+activity.deals.length+activity.favorites.length+activity.contact_requests.length],["offers","Offers",activity.bids.length],["bids","Bids",activity.bids.length],["listings","Listings",activity.listings.length],["deals","Deals",activity.deals.length],["requests","Requests",activity.contact_requests.length],["saved","Saved",activity.favorites.length]] as const).map(([key,label,count]) => (
                      <Link key={key} href={{pathname:"/customer/exchange",query:{account:account.id,tab:"activity",activityFilter:key}}}
                        aria-current={activityFilter===key?"page":undefined}
                        className={`block rounded-lg px-3 py-2 text-[11px] transition hover:bg-[#EAF1FB] ${activityFilter===key?"bg-[#E7F0FD] font-bold text-[#123967]":"text-[#6880A4]"}`}>
                        {label} ({count})
                      </Link>
                    ))}
                  </nav>
                </details>
              </div>
              <div className="space-y-2">
                {(activityFilter==="all"||activityFilter==="bids"||activityFilter==="offers") ? <ActivitySection title="Offers / Bids" rows={activity.bids} accountId={account.id} /> : null}
                {(activityFilter==="all"||activityFilter==="listings") ? <ActivitySection title="My Listings" rows={activity.listings} accountId={account.id} /> : null}
                {(activityFilter==="all"||activityFilter==="deals") ? <ActivitySection title="Deals" rows={activity.deals} accountId={account.id} /> : null}
                {(activityFilter==="all"||activityFilter==="saved") ? <ActivitySection title="Saved Vehicles" rows={activity.favorites} accountId={account.id} /> : null}
                {(activityFilter==="all"||activityFilter==="requests") ? <ActivitySection title="Contact Requests" rows={activity.contact_requests} accountId={account.id} /> : null}
                {(activityFilter!=="all" && (activityFilter==="bids"||activityFilter==="offers"?activity.bids:activityFilter==="listings"?activity.listings:activityFilter==="deals"?activity.deals:activityFilter==="saved"?activity.favorites:activity.contact_requests).length===0) ? <div className="rounded-xl bg-[#F7F9FD] py-10 text-center text-[12px] text-[#64748B]">No {activityFilter} activity yet.</div> : null}
              </div>
            </div>
          </section>
        )
      ) : null}
    </div>
  );
}

function tabClass(active: boolean) {
  return `exchange-premium-tab flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[11px] font-black transition ${
    active ? "exchange-reference-active-tab bg-[#173B68] text-white" : "text-[#63738A] hover:bg-[#F3F7FC]"
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

function ActivitySection({ title, rows, accountId }: { title: string; rows: Array<Record<string, unknown>>; accountId: string }) {
  if (!rows.length) return null;
  return <div className="space-y-2">
    {rows.slice(0, 20).map((row,index)=>{
      const vehicleName=valueText(row.title)||[valueText(row.make),valueText(row.model)].filter(Boolean).join(" ")||valueText(row.listing_no)||valueText(row.deal_no)||valueText(row.request_type)||title;
      const status=valueText(row.status).replaceAll("_"," ");
      const low=status.toLowerCase();
      const leading=low.includes("leading")||low.includes("winning");
      const outbid=low.includes("outbid");
      const listingId=valueText(row.listing_id);
      const href=listingId?{pathname:`/customer/exchange/${encodeURIComponent(listingId)}`,query:{account:accountId}}:null;
      const amount=Number(row.amount??row.agreed_price??row.asking_price??0);
      const cover=valueText(row.cover_url);
      const meta=[row.year,row.odometer_km!=null?`${Number(row.odometer_km).toLocaleString("en-IN")} km`:null,row.fuel_type,row.masked_registration].filter(v=>v!=null&&v!=="").join("  |  ");
      return <div key={valueText(row.bid_id)||valueText(row.listing_id)||valueText(row.deal_id)||valueText(row.request_id)||index} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E4EAF3] bg-white px-3 py-2.5 transition hover:border-[#C8D8F1] hover:shadow-sm md:flex-nowrap">
        <div className="grid h-[58px] w-[94px] shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-[#EAF2FD] to-[#D6E5F7]">{cover?<img src={cover} alt="" className="h-full w-full object-cover"/>:<Truck className="h-8 w-8 text-[#6D8AB2]"/>}</div>
        <div className="min-w-[160px] flex-1"><p className="truncate text-[12px] font-extrabold text-[#15386F]">{vehicleName}</p><p className="mt-1 truncate text-[10px] text-[#8B9AB2]">{meta||title}</p></div>
        <div className="min-w-[90px]"><span className={`inline-flex rounded-lg px-2.5 py-1.5 text-[10px] font-bold capitalize ${leading?"bg-[#E1F8EE] text-[#11986A]":outbid?"bg-[#FFF0F2] text-[#DF3A58]":"bg-[#EAF1FF] text-[#426BCA]"}`}>{status||title}</span></div>
        <div className="hidden min-w-[130px] flex-1 text-[10px] text-[#7A8CA9] lg:block">{leading?"You are leading on this vehicle.":outbid?"A higher bid has been placed.":status?`Status: ${status}`:title}</div>
        <div className="min-w-[90px] text-right"><p className="text-[12px] font-black text-[#10264C]">{amount>0?formatCustomerCompactMoney(amount):"—"}</p><p className="mt-1 text-[9px] text-[#8B9AB2]">{title==="Offers / Bids"?"Your bid":"Amount"}</p></div>
        {href?<Link href={href} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#EDF3FF] px-3 py-2 text-[10px] font-bold text-[#245FD1] hover:bg-[#DAE8FF]">View Details <ChevronRight className="h-3.5 w-3.5"/></Link>:<span className="text-[10px] text-[#94A3B8]">Details unavailable</span>}
      </div>;
    })}
  </div>;
}

function valueText(value: unknown) {
  return typeof value === "string" ? value : "";
}
