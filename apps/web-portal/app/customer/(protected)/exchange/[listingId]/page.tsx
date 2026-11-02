import Link from "next/link";
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, Clock3, FileText, Fuel, Gauge, ImageIcon, MapPin, ShieldCheck, Truck } from "lucide-react";
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
  searchParams?: Promise<{ account?: string }>;
}) {
  const { listingId } = await params;
  const query = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(query.account);
  const { listing, detail } = await loadCustomerExchangeListing(listingId);
  const backHref = { pathname: "/customer/exchange", query: { account: account.id } };
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
    <div className="space-y-3 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#536C8D] hover:text-[#17365D]"><ArrowLeft className="h-3.5 w-3.5" /> Back to Exchange</Link>
        <span className="rounded-full border border-[#D9E3F0] bg-white px-3 py-1.5 text-[10px] font-semibold text-[#64748B]">Listing {listing.listing_no}</span>
      </div>
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/exchange" />
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE5F1] bg-white px-4 py-3 shadow-[0_5px_24px_rgba(18,51,90,.04)]">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[.13em] text-[#8698AF]">Exchange vehicle listing</p>
          <h1 className="mt-1 text-[clamp(17px,2vw,23px)] font-extrabold leading-tight text-[#102A50]">{vehicleName}</h1>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-[#687E9A]"><MapPin className="h-3.5 w-3.5" />{location}</p>
        </div>
        {listing.documents_verified ? <span className="inline-flex items-center gap-1 rounded-full border border-[#BDEAD3] bg-[#EAF8F1] px-3 py-1.5 text-[10px] font-bold text-[#087D55]"><BadgeCheck className="h-3.5 w-3.5" /> Documents verified</span> : <span className="inline-flex items-center gap-1 rounded-full border border-[#DCE5F1] bg-[#F6F8FC] px-3 py-1.5 text-[10px] font-bold text-[#637795]"><Clock3 className="h-3.5 w-3.5" /> Documents not yet verified</span>}
      </header>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <section className="min-w-0 rounded-2xl border border-[#DCE5F1] bg-white p-3 shadow-[0_5px_24px_rgba(18,51,90,.04)]" aria-label="Vehicle photo gallery">
          <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#EEF5FC] to-[#E0EBF7]">
            <img src={mainImage} alt={hasRealPhoto ? `${vehicleName} listing photo` : `${vehicleName} vehicle-category illustration`} className={`h-full w-full ${hasRealPhoto ? "object-cover" : "object-contain p-6"}`} />
            {!hasRealPhoto ? <span className="absolute bottom-3 left-3 rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[10px] font-semibold text-[#537096]"><ImageIcon className="mr-1 inline h-3 w-3" /> Illustration · photos not available</span> : null}
          </div>
          {photos.length > 1 ? <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {photos.slice(0, 6).map(photo => <a key={photo.id} href={photo.signed_url!} target="_blank" rel="noopener noreferrer" aria-label={photo.label || "Open listing photo"} className="h-[66px] w-[90px] shrink-0 overflow-hidden rounded-lg border border-[#DCE5F1]"><img src={photo.signed_url!} alt={photo.label || "Additional vehicle photograph"} className="h-full w-full object-cover" /></a>)}
          </div> : null}
          <p className="mt-2 text-[10px] text-[#71829B]">{photos.length ? `${photos.length} listing photo${photos.length === 1 ? "" : "s"} available` : "Images shown for illustration unless actual listing photographs are uploaded."}</p>
        </section>

        <aside className="min-w-0 rounded-2xl border border-[#DCE5F1] bg-white p-4 shadow-[0_5px_24px_rgba(18,51,90,.04)] lg:sticky lg:top-5">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8194AC]">Asking price</p>
          <p className="mt-1 text-[clamp(27px,3vw,35px)] font-extrabold tracking-tight text-[#102A50]">{Number(listing.asking_price || 0) > 0 ? formatCustomerCompactMoney(Number(listing.asking_price)) : "Price on request"}</p>
          <p className="mt-1 text-[11px] text-[#71829B]">{listing.selling_mode.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase())}</p>
          <div className="my-3 h-px bg-[#E8EDF5]" />
          <div className="grid grid-cols-2 gap-2">
            {features.map(({ label, value, icon: Icon }) => <div key={label} className="min-w-0 rounded-xl border border-[#E3EAF3] bg-[#F8FAFD] p-3">
              <Icon className="h-4 w-4 text-[#5577A2]" />
              <p className="mt-1 text-[10px] text-[#7B8CA2]">{label}</p>
              <p className="mt-0.5 break-words text-[12px] font-bold text-[#19375D]">{value}</p>
            </div>)}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {listing.owner_verified ? <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF8F1] px-2.5 py-1.5 text-[10px] font-bold text-[#087D55]"><BadgeCheck className="h-3.5 w-3.5" /> Owner verified</span> : null}
            {listing.inspected ? <span className="inline-flex items-center gap-1 rounded-full bg-[#E9F1FF] px-2.5 py-1.5 text-[10px] font-bold text-[#2859A7]"><CheckCircle2 className="h-3.5 w-3.5" /> Inspected {listing.inspection_score != null ? `· ${listing.inspection_score}` : ""}</span> : null}
            {detail?.authbridge_verified ? <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF8F1] px-2.5 py-1.5 text-[10px] font-bold text-[#087D55]"><ShieldCheck className="h-3.5 w-3.5" /> AuthBridge verified</span> : null}
          </div>
          <div className="mt-4 rounded-xl border border-[#DCE6F3] bg-[#F7FAFE] p-3">
            <p className="text-[12px] font-bold text-[#17365D]">Interested in this vehicle?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#647895]">Review your offers and enquiries in Exchange Activity. New bidding and seller contact actions will appear here once enabled for this listing.</p>
            <Link href={{ pathname: "/customer/exchange", query: { account: account.id, tab: "activity" } }} className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-[#17365D] px-3 text-[11px] font-bold text-white hover:bg-[#102A4C]">View Exchange Activity</Link>
          </div>
        </aside>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#DCE5F1] bg-white p-4 shadow-[0_5px_24px_rgba(18,51,90,.04)]">
          <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-[#102A50]"><Truck className="h-4 w-4 text-[#316BB8]" /> Vehicle specifications</h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {specifications.map(([label, value]) => <div key={label} className="rounded-lg border border-[#E6ECF4] bg-[#FAFCFE] p-3"><dt className="text-[10px] font-semibold text-[#7B8DA4]">{label}</dt><dd className="mt-1 break-words text-[12px] font-bold text-[#203E65]">{value}</dd></div>)}
          </dl>
        </section>
        <section className="rounded-2xl border border-[#DCE5F1] bg-white p-4 shadow-[0_5px_24px_rgba(18,51,90,.04)]">
          <h2 className="flex items-center gap-2 text-[14px] font-extrabold text-[#102A50]"><ShieldCheck className="h-4 w-4 text-[#316BB8]" /> Registration & documents</h2>
          <div className="mt-3 divide-y divide-[#E9EEF5]">
            {documentRows.map(([name, rawDate]) => {
              const status = expiryStatus(rawDate);
              return <div key={name} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-[#8496AC]" /><span className="text-[11px] font-semibold text-[#334E71]">{name}</span></div>
                <div className="text-right"><p className="text-[11px] font-semibold text-[#253E5E]">{rawDate ? formatCustomerCompactDate(rawDate) : "Not provided"}</p><p className={`text-[10px] font-medium ${status === "Expired" ? "text-[#B14A4A]" : status === "Valid" ? "text-[#15835B]" : "text-[#8090A7]"}`}>{status}</p></div>
              </div>;
            })}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-[#7789A0]">Document dates are provided for information. Confirm current validity with the seller or issuing authority before purchase.</p>
        </section>
      </div>
    </div>
  );
}
