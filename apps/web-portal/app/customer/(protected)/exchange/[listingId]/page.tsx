import Link from "next/link";
import { ArrowLeft, BadgeCheck, CalendarDays, Gauge, MapPin, ShieldCheck, Truck } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  formatCustomerCompactDate,
  formatCustomerCompactMoney,
  loadCustomerExchangeListing,
} from "@/lib/customer-web-phase3-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerExchangeListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams?: Promise<{ account?: string }>;
}) {
  const { listingId } = await params;
  const query = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const { listing, detail } = await loadCustomerExchangeListing(listingId);

  const rows = [
    ["Registration", listing.masked_registration || "—"],
    ["Fuel", listing.fuel_type || "—"],
    ["Ownership", listing.ownership_count ? `${listing.ownership_count} owner` : "Verified"],
    ["Body type", detail?.body_type || "—"],
    ["GVW", detail?.gvw_kg ? `${Number(detail.gvw_kg).toLocaleString("en-IN")} kg` : "—"],
    ["Emission", detail?.emission_norm || "—"],
    ["Fitness", formatCustomerCompactDate(detail?.fitness_expiry_date)],
    ["PUC", formatCustomerCompactDate(detail?.puc_expiry_date)],
    ["Road tax", formatCustomerCompactDate(detail?.road_tax_expiry_date)],
    ["Permit", formatCustomerCompactDate(detail?.national_permit_expiry_date ?? detail?.local_permit_expiry_date)],
    ["Insurance", formatCustomerCompactDate(detail?.insurance?.end_date)],
    ["Financer", detail?.financer_name || (detail?.financed ? "Financed" : "Not financed / unavailable")],
  ];

  return (
    <div className="space-y-5">
      <Link href={{ pathname: "/customer/exchange", query: { account: account.id } }} className="inline-flex items-center gap-1 text-[11px] font-black text-[#53627A] hover:text-[#142746]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Exchange
      </Link>
      <CustomerPageHeading
        eyebrow="Exchange listing"
        title={`${listing.year ? `${listing.year} ` : ""}${listing.title}`}
        description={[listing.city, listing.state].filter(Boolean).join(", ") || listing.masked_registration}
        action={<StatusPill tone={listing.documents_verified ? "active" : "neutral"}>{listing.documents_verified ? "Verified listing" : "Verification in progress"}</StatusPill>}
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/exchange" />

      <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
          <div className="flex min-h-56 items-center justify-center rounded-2xl bg-[#F3F6FA]">
            <Truck className="h-20 w-20 text-[#8190A6]" />
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[#8794A7]">Asking price</p>
              <p className="mt-1 text-[28px] font-black tracking-[-0.03em] text-[#10213D]">{formatCustomerCompactMoney(Number(listing.asking_price || 0))}</p>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-bold text-[#758399]">
                <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{listing.odometer_km ? `${Number(listing.odometer_km).toLocaleString("en-IN")} km` : "Odometer verified"}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[listing.city,listing.state].filter(Boolean).join(", ") || "Location on request"}</span>
              </div>
            </div>
            <div className="space-y-2 text-right">
              {listing.owner_verified ? <p className="inline-flex items-center gap-1 text-[10px] font-black text-[#0B7A54]"><BadgeCheck className="h-4 w-4" />Owner verified</p> : null}
              {listing.inspected ? <p className="text-[10px] font-black text-[#174EA6]">Inspection score: {listing.inspection_score ?? "Recorded"}</p> : null}
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-[#D8E1EC] bg-[#F8FAFD] px-3 py-3 text-[10.5px] font-semibold leading-5 text-[#607089]">
            Exchange actions such as bidding, favorites, callback requests and selling remain available in the Customer App for this web phase. This page is intentionally read-only.
          </div>
        </section>

        <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
          <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#174EA6]" /><h2 className="text-[13px] font-black text-[#10213D]">Vehicle health & documents</h2></div>
          <div className="mt-4 grid gap-2">
            {rows.map(([label,value]) => (
              <div key={label} className="flex items-start justify-between gap-4 rounded-xl bg-[#F7F9FC] px-3 py-2.5">
                <span className="text-[9.5px] font-bold text-[#8794A7]">{label}</span>
                <span className="max-w-[60%] text-right text-[10.5px] font-black text-[#35445B]">{value}</span>
              </div>
            ))}
          </div>
          {detail?.authbridge_verified ? <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#ECF8F2] px-2.5 py-1 text-[9px] font-black text-[#0B7A54]"><ShieldCheck className="h-3 w-3" />AuthBridge verified</p> : null}
        </section>
      </div>
    </div>
  );
}
