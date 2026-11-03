import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BadgeCheck, CalendarDays, CheckCircle2, Clock3, FileText, Fuel, Gauge, ImageIcon, MapPin, ShieldCheck, Truck } from "lucide-react";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { customerExchangeVehicleArt } from "@/lib/customer-exchange-vehicle-art";
import { formatCustomerCompactDate, formatCustomerCompactMoney, loadCustomerExchangeListing } from "@/lib/customer-web-phase3-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function expiryStatus(value: string | null | undefined) {
  if (!value) return "Not provided";
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "Not provided";
  return when.getTime() < Date.now() ? "Expired" : "Valid";
}

export default async function CustomerExchangeListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams?: Promise<{ account?: string; tab?: string; activityFilter?: string; activityQuery?: string }>;
}) {
  const { listingId } = await params;
  const query = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const fromActivity = query.tab === "activity";
  const backHref = { pathname: "/customer/exchange", query: { account: account.id, tab: fromActivity ? "activity" : "buy", ...(fromActivity && query.activityFilter ? { activityFilter: query.activityFilter } : {}), ...(fromActivity && query.activityQuery ? { activityQuery: query.activityQuery } : {}) } };
  const { listing, detail } = await loadCustomerExchangeListing(listingId);
  const location = [listing.city, listing.state].filter(Boolean).join(", ") || "Location on request";
  const vehicleName = [listing.year, listing.title].filter(Boolean).join(" ");
  const bike = /bike|motorcycle|scooter|two.?wheel|pulsar/i.test([listing.vehicle_type, listing.category, listing.title].join(" "));
  const fallback = customerExchangeVehicleArt(bike ? "motorcycle" : listing.vehicle_type, listing.category);
  const photos = (detail?.media ?? []).filter(item => item.media_type === "photo" && item.signed_url);
  const mainPhoto = photos.find(item => item.is_cover) ?? photos[0];
  const mainImage = mainPhoto?.signed_url ?? listing.cover_url ?? fallback;
  const hasRealPhoto = Boolean(mainPhoto?.signed_url || listing.cover_url);
  const features = [
    { label: "Model year", value: listing.year ? String(listing.year) : "Not provided", icon: CalendarDays },
    { label: "Driven", value: listing.odometer_km != null ? `${Number(listing.odometer_km).toLocaleString("en-IN")} km` : "Not provided", icon: Gauge },
    { label: "Fuel type", value: listing.fuel_type || "Not provided", icon: Fuel },
    { label: "Location", value: listing.city || location, icon: MapPin },
  ];
  const specifications = [
    ["Registration", listing.masked_registration || "Not provided"],
    ["Owner count", listing.ownership_count ? String(listing.ownership_count) : "Not provided"],
    ["Body type", detail?.body_type || "Not provided"],
    ["Gross vehicle weight", detail?.gvw_kg != null ? `${Number(detail.gvw_kg).toLocaleString("en-IN")} kg` : "Not provided"],
    ["Emission standard", detail?.emission_norm || "Not provided"],
    ["Finance status", detail?.financer_name || (detail?.financed === true ? "Financed" : detail?.financed === false ? "Not financed" : "Not provided")],
  ];
  const documentRows = [
    ["Fitness", detail?.fitness_expiry_date],
    ["PUC", detail?.puc_expiry_date],
    ["Road tax", detail?.road_tax_expiry_date],
    ["Permit", detail?.national_permit_expiry_date ?? detail?.local_permit_expiry_date],
    ["Insurance", detail?.insurance?.end_date],
  ] as const;

  return (
    <div className="space-y-2 pb-4">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#536C8D] hover:text-[#17365D]"><ArrowLeft className="h-3.5 w-3.5" /> {fromActivity ? "Back to Activity" : "Back to Exchange"}</Link>
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/exchange" />
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE5F1] bg-white px-3 py-2.5 shadow-[0_5px_24px_rgba(18,51,90,.04)]">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[.13em] text-[#8698AF]">Exchange vehicle listing</p>
          <h1 className="mt-1 text-[clamp(17px,1.7vw,21px)] font-extrabold leading-tight text-[#102A50]">{vehicleName}</h1>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-[#687E9A]"><MapPin className="h-3.5 w-3.5" />{location}</p>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">{features.map(({label,value,icon:Icon}) => <div key={label} className="min-w-0 border-l border-[#E4EAF2] pl-2.5"><p className="flex items-center gap-1 text-[9px] text-[#71829B]"><Icon className="h-3 w-3 shrink-0" />{label}</p><p className="truncate text-[11px] font-bold text-[#19375D]" title={value}>{value}</p></div>)}</div>
        <div className="min-w-[130px] border-l border-[#E4EAF2] pl-4"><p className="text-[9px] font-semibold text-[#8194AC]">Asking price</p><p className="text-[clamp(22px,2.5vw,29px)] font-extrabold text-[#102A50]">{Number(listing.asking_price || 0) > 0 ? formatCustomerCompactMoney(Number(listing.asking_price)) : "Price on request"}</p><p className="text-[9px] capitalize text-[#71829B]">{listing.selling_mode.replaceAll("_", " ")}</p></div>
        {listing.documents_verified ? <span className="inline-flex items-center gap-1 rounded-full border border-[#BDEAD3] bg-[#EAF8F1] px-3 py-1.5 text-[10px] font-bold text-[#087D55]"><BadgeCheck className="h-3.5 w-3.5" /> Documents verified</span> : <span className="inline-flex items-center gap-1 rounded-full border border-[#DCE5F1] bg-[#F6F8FC] px-3 py-1.5 text-[10px] font-bold text-[#637795]"><Clock3 className="h-3.5 w-3.5" /> Documents not yet verified</span>}
      </header>

      <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
        <section className="min-w-0 rounded-xl border border-[#DCE5F1] bg-white p-2 shadow-[0_5px_24px_rgba(18,51,90,.04)]" aria-label="Vehicle photo gallery">
          <div className="relative flex h-[clamp(190px,22vw,280px)] items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#EEF5FC] to-[#E0EBF7]">
            <img src={mainImage} alt={hasRealPhoto ? `${vehicleName} listing photo` : `${vehicleName} vehicle-category illustration`} className={`h-full w-full ${hasRealPhoto ? "object-contain" : "object-contain p-2"}`} />
            {!hasRealPhoto ? <span className="absolute bottom-3 left-3 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[10px] font-semibold text-[#537096]"><ImageIcon className="mr-1 inline h-3 w-3" /> Illustration · photos not available</span> : null}
          </div>
          {photos.length > 1 ? <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {photos.slice(0, 6).map(photo => <a key={photo.id} href={photo.signed_url!} target="_blank" rel="noopener noreferrer" aria-label={photo.label || "Open listing photo"} className="h-[40px] w-[58px] shrink-0 overflow-hidden rounded-md border border-[#DCE5F1]"><img src={photo.signed_url!} alt={photo.label || "Additional vehicle photograph"} className="h-full w-full object-cover" /></a>)}
          </div> : null}
          {photos.length ? <p className="mt-1 text-[9px] text-[#71829B]">{photos.length} photos</p> : null}
        </section>

        <aside className="min-w-0 rounded-xl border border-[#DCE5F1] bg-white p-2.5 shadow-[0_5px_24px_rgba(18,51,90,.04)] ">
          <div className="flex flex-wrap gap-1.5">
            {listing.owner_verified ? <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF8F1] px-2.5 py-1.5 text-[10px] font-bold text-[#087D55]"><BadgeCheck className="h-3.5 w-3.5" /> Owner verified</span> : null}
            {listing.inspected ? <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F1FF] px-2.5 py-1.5 text-[10px] font-bold text-[#2859A7]"><CheckCircle2 className="h-3.5 w-3.5" /> Inspected {listing.inspection_score != null ? `· ${listing.inspection_score}` : ""}</span> : null}
            {detail?.authbridge_verified ? <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF8F1] px-2.5 py-1.5 text-[10px] font-bold text-[#087D55]"><ShieldCheck className="h-3.5 w-3.5" /> AuthBridge verified</span> : null}
          </div>
          <Link href={{ pathname: "/customer/exchange", query: { account: account.id, tab: "activity" } }} className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-[#17365D] px-3 text-[11px] font-bold text-white hover:bg-[#102A4C]">View Exchange Activity</Link>
        </aside>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#DCE5F1] bg-white p-3 shadow-[0_5px_24px_rgba(18,51,90,.04)]">
          <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-[#102A50]"><Truck className="h-4 w-4 text-[#316BB8]" /> Vehicle specifications</h2>
          <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {specifications.map(([label, value]) => <div key={label} className="rounded-lg border border-[#E6ECF4] bg-[#FAFCFE] p-2"><dt className="text-[10px] font-semibold text-[#7B8DA4]">{label}</dt><dd className="mt-1 break-words text-[12px] font-bold text-[#203E65]">{value}</dd></div>)}
          </dl>
        </section>
        <section className="rounded-2xl border border-[#DCE5F1] bg-white p-3 shadow-[0_5px_24px_rgba(18,51,90,.04)]">
          <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-[#102A50]"><ShieldCheck className="h-4 w-4 text-[#316BB8]" /> Registration & documents</h2>
          <div className="mt-2 divide-y divide-[#E9EEF5]">
            {documentRows.map(([name, rawDate]) => {
              const status = expiryStatus(rawDate);
              return <div key={name} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-[#8496AC]" /><span className="text-[11px] font-semibold text-[#334E71]">{name}</span></div>
                <div className="text-right"><p className="text-[11px] font-semibold text-[#253E5E]">{rawDate ? formatCustomerCompactDate(rawDate) : "Not provided"}</p><p className={`text-[10px] font-medium ${status === "Expired" ? "text-[#B14A4A]" : status === "Valid" ? "text-[#15835B]" : "text-[#8090A7]"}`}>{status}</p></div>
              </div>;
            })}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#7789A0]">Confirm document validity before purchase.</p>
        </section>
      </div>
    </div>
  );
}
