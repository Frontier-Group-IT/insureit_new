import Image from "next/image";
import { redirect } from "next/navigation";
import { BadgeCheck, Camera, Clock3, Search, ShieldCheck, Store, XCircle } from "lucide-react";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { reviewExchangeListing } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const allowedReviewRoles = new Set(["super_admin", "it_super_user", "sales_head", "sales_operations_head"]);
const reviewStatuses = ["pending_review", "live", "rejected"] as const;
type ReviewStatus = (typeof reviewStatuses)[number];

type ListingRow = {
  id: string;
  listing_no: string;
  seller_customer_id: string;
  vehicle_id: string;
  status: string;
  selling_mode: string;
  title: string;
  category: string;
  city: string | null;
  state: string | null;
  odometer_km: number | null;
  asking_price: number;
  owner_verification_status: string;
  document_verification_status: string;
  inspection_status: string;
  inspection_score: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  published_at: string | null;
  created_at: string;
};

type VehicleRow = {
  id: string;
  vehicle_no: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  fuel_type: string | null;
  vehicle_type: string | null;
};

type CustomerRow = {
  id: string;
  customer_code: string | null;
  company_name: string | null;
  contact_name: string | null;
  phone: string | null;
};

type MediaRow = {
  id: string;
  listing_id: string;
  label: string | null;
  storage_bucket: string;
  storage_path: string;
  is_cover: boolean;
  sort_order: number;
};

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

export default async function ExchangeListingReviewPage({ searchParams }: PageProps) {
  const profile = await requireCapability("review_exchange_listings", "approve");
  if (!allowedReviewRoles.has(String(profile.role))) redirect("/access-denied");

  const params = await searchParams;
  const activeStatus = params.status === "all" || reviewStatuses.includes(params.status as ReviewStatus)
    ? params.status
    : "pending_review";
  const query = (params.q ?? "").trim().toLowerCase();

  const admin = createSupabaseAdminClient();
  const { data: listingData, error } = await admin
    .from("exchange_listings")
    .select("id,listing_no,seller_customer_id,vehicle_id,status,selling_mode,title,category,city,state,odometer_km,asking_price,owner_verification_status,document_verification_status,inspection_status,inspection_score,submitted_at,reviewed_at,review_notes,published_at,created_at")
    .in("status", ["pending_review", "live", "rejected"])
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(250)
    .returns<ListingRow[]>();

  const listings = listingData ?? [];
  const vehicleIds = Array.from(new Set(listings.map((row) => row.vehicle_id)));
  const customerIds = Array.from(new Set(listings.map((row) => row.seller_customer_id)));
  const listingIds = listings.map((row) => row.id);

  const [{ data: vehicles }, { data: customers }, { data: media }] = await Promise.all([
    vehicleIds.length
      ? admin.from("vehicles").select("id,vehicle_no,make,model,year,fuel_type,vehicle_type").in("id", vehicleIds).returns<VehicleRow[]>()
      : Promise.resolve({ data: [] as VehicleRow[] }),
    customerIds.length
      ? admin.from("customers").select("id,customer_code,company_name,contact_name,phone").in("id", customerIds).returns<CustomerRow[]>()
      : Promise.resolve({ data: [] as CustomerRow[] }),
    listingIds.length
      ? admin.from("exchange_listing_media").select("id,listing_id,label,storage_bucket,storage_path,is_cover,sort_order").in("listing_id", listingIds).eq("media_type", "photo").order("sort_order").returns<MediaRow[]>()
      : Promise.resolve({ data: [] as MediaRow[] }),
  ]);

  const vehicleById = new Map((vehicles ?? []).map((row) => [row.id, row]));
  const customerById = new Map((customers ?? []).map((row) => [row.id, row]));
  const mediaByListing = new Map<string, MediaRow[]>();
  for (const item of media ?? []) {
    const current = mediaByListing.get(item.listing_id) ?? [];
    current.push(item);
    mediaByListing.set(item.listing_id, current);
  }

  const signedUrlEntries = await Promise.all(
    (media ?? []).map(async (item) => {
      const { data } = await admin.storage.from(item.storage_bucket).createSignedUrl(item.storage_path, 3600);
      return [item.id, data?.signedUrl ?? null] as const;
    }),
  );
  const signedUrlByMedia = new Map(signedUrlEntries);

  const counts = {
    pending_review: listings.filter((row) => row.status === "pending_review").length,
    live: listings.filter((row) => row.status === "live").length,
    rejected: listings.filter((row) => row.status === "rejected").length,
    all: listings.length,
  };

  const filtered = listings.filter((row) => {
    if (activeStatus !== "all" && row.status !== activeStatus) return false;
    if (!query) return true;
    const vehicle = vehicleById.get(row.vehicle_id);
    const customer = customerById.get(row.seller_customer_id);
    const haystack = [
      row.listing_no,
      row.title,
      row.category,
      vehicle?.vehicle_no,
      vehicle?.make,
      vehicle?.model,
      customer?.customer_code,
      customer?.company_name,
      customer?.contact_name,
      customer?.phone,
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  });

  return (
    <ClaimManagerShell title="Exchange Listing Review" activeNav="exchange">
      <div className="mx-auto max-w-[1500px] space-y-3">
        <header className="flex flex-col gap-3 rounded-[22px] border border-[#E3E8F0] bg-white px-5 py-4 shadow-[0_12px_36px_rgba(37,39,92,0.06)] md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#3156B8]">
              <Store className="h-3.5 w-3.5" />
              Exchange
            </div>
            <h1 className="mt-1 text-[20px] font-black tracking-[-0.02em] text-[#171D3D]">Listing Review</h1>
            <p className="mt-1 text-[11px] text-[#6D778C]">Review submitted vehicle evidence, then approve publication or reject with a clear reason.</p>
          </div>
          <form className="relative w-full md:w-[320px]" action="/exchange/listings">
            <input type="hidden" name="status" value={activeStatus} />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B95A6]" />
            <input name="q" defaultValue={params.q ?? ""} placeholder="Search listing, RC, seller…" className="h-10 w-full rounded-xl border border-[#DDE3EC] bg-[#F8FAFC] pl-9 pr-3 text-[11px] font-semibold text-[#26324A] outline-none focus:border-[#3156B8]" />
          </form>
        </header>

        <nav className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#E5EAF1] bg-white p-1.5">
          <StatusTab href="/exchange/listings?status=pending_review" active={activeStatus === "pending_review"} label="Pending" count={counts.pending_review} />
          <StatusTab href="/exchange/listings?status=live" active={activeStatus === "live"} label="Live" count={counts.live} />
          <StatusTab href="/exchange/listings?status=rejected" active={activeStatus === "rejected"} label="Rejected" count={counts.rejected} />
          <StatusTab href="/exchange/listings?status=all" active={activeStatus === "all"} label="All" count={counts.all} />
          <span className="ml-auto hidden pr-2 text-[10px] font-semibold text-[#7B8498] sm:block">{filtered.length} shown</span>
        </nav>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">Exchange listings could not be loaded.</div>
        ) : null}

        <section className="overflow-hidden rounded-[22px] border border-[#E3E8F0] bg-white shadow-[0_14px_42px_rgba(37,39,92,0.055)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left">
              <thead className="border-b border-[#E8ECF2] bg-[#F8FAFC] text-[9px] font-black uppercase tracking-[0.09em] text-[#6C778C]">
                <tr>
                  <th className="px-4 py-3">Listing / vehicle</th>
                  <th className="px-4 py-3">Seller</th>
                  <th className="px-4 py-3">Commercials</th>
                  <th className="px-4 py-3">Evidence</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDF1F5]">
                {filtered.map((row) => {
                  const vehicle = vehicleById.get(row.vehicle_id);
                  const customer = customerById.get(row.seller_customer_id);
                  const photos = (mediaByListing.get(row.id) ?? []).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
                  const cover = photos[0];
                  return (
                    <tr key={row.id} className="align-top text-[11px] text-[#34405A] hover:bg-[#FBFCFE]">
                      <td className="px-4 py-4">
                        <div className="flex min-w-[290px] gap-3">
                          <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-[#E0E5EC] bg-[#F1F4F7]">
                            {cover && signedUrlByMedia.get(cover.id) ? (
                              <Image src={signedUrlByMedia.get(cover.id)!} alt={row.title} fill unoptimized className="object-cover" />
                            ) : (
                              <div className="grid h-full place-items-center text-[#9AA4B4]"><Camera className="h-5 w-5" /></div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-black text-[#171D3D]">{row.listing_no}</p>
                              <StatusPill status={row.status} />
                            </div>
                            <p className="mt-1 max-w-[270px] truncate font-black text-[#1E2940]">{row.title}</p>
                            <p className="mt-1 text-[10px] font-semibold text-[#758095]">{vehicle?.vehicle_no ?? "—"} · {vehicle?.year ?? "Year —"} · {row.category}</p>
                            <p className="mt-0.5 text-[9px] text-[#8A94A5]">{[row.city, row.state].filter(Boolean).join(", ") || "Location not set"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-black text-[#171D3D]">{customer?.company_name || customer?.contact_name || "Customer"}</p>
                        <p className="mt-1 text-[10px] text-[#788397]">{customer?.customer_code || "—"}</p>
                        <p className="mt-1 text-[10px] font-semibold text-[#4E5D75]">{customer?.phone || "No phone"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-[14px] font-black text-[#171D3D]">{money(Number(row.asking_price))}</p>
                        <p className="mt-1 text-[9px] font-black uppercase text-[#60708A]">{modeLabel(row.selling_mode)}</p>
                        <p className="mt-1 text-[10px] text-[#7A8597]">{row.odometer_km == null ? "Odometer —" : `${Number(row.odometer_km).toLocaleString("en-IN")} km`}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5">
                          {photos.slice(0, 4).map((photo) => signedUrlByMedia.get(photo.id) ? (
                            <div key={photo.id} className="relative h-9 w-11 overflow-hidden rounded-lg border border-[#E2E7EF] bg-[#F3F5F8]">
                              <Image src={signedUrlByMedia.get(photo.id)!} alt={photo.label || "Vehicle photo"} fill unoptimized className="object-cover" />
                            </div>
                          ) : null)}
                          <span className={`ml-1 inline-flex rounded-full px-2 py-1 text-[9px] font-black ${photos.length >= 6 ? "bg-[#EAF7F0] text-[#147A55]" : "bg-[#FFF3E1] text-[#996000]"}`}>{photos.length}/6 photos</span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Signal ok={row.owner_verification_status === "verified"} label="Owner" />
                          <Signal ok={row.document_verification_status === "verified"} label="Docs" />
                          <Signal ok={row.inspection_status === "completed"} label="Inspection" />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-[#38445A]">{dateTime(row.submitted_at || row.created_at)}</p>
                        {row.reviewed_at ? <p className="mt-1 text-[9px] text-[#8A94A5]">Reviewed {dateTime(row.reviewed_at)}</p> : null}
                        {row.review_notes ? <p className="mt-2 max-w-[190px] text-[9px] leading-4 text-[#7B5360]">{row.review_notes}</p> : null}
                      </td>
                      <td className="px-4 py-4">
                        {row.status === "pending_review" ? (
                          <details className="min-w-[245px] rounded-xl border border-[#DFE5ED] bg-[#FBFCFE] p-2.5">
                            <summary className="cursor-pointer list-none text-[10px] font-black text-[#3156B8]">Review listing</summary>
                            <form action={reviewExchangeListing} className="mt-3 space-y-2">
                              <input type="hidden" name="listing_id" value={row.id} />
                              <label className="flex items-center gap-2 text-[9px] font-bold text-[#536078]">
                                <input type="checkbox" name="document_verified" value="1" className="h-3.5 w-3.5 rounded border-[#BBC6D6]" />
                                Documents verified
                              </label>
                              <label className="block text-[9px] font-bold text-[#536078]">
                                Inspection score
                                <input name="inspection_score" inputMode="numeric" placeholder="Optional 0–100" className="mt-1 h-8 w-full rounded-lg border border-[#DCE3EC] bg-white px-2 text-[10px] font-semibold outline-none focus:border-[#3156B8]" />
                              </label>
                              <button name="decision" value="approve" disabled={photos.length < 6} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#164BB8] text-[10px] font-black text-white disabled:cursor-not-allowed disabled:bg-[#AEB8C8]">
                                <BadgeCheck className="h-3.5 w-3.5" /> Approve & publish
                              </button>
                              {photos.length < 6 ? <p className="text-[8.5px] font-semibold leading-3 text-[#9A6500]">Approval unlocks after all 6 guided photos are present.</p> : null}
                              <textarea name="notes" rows={2} placeholder="Rejection reason (required to reject)" className="w-full resize-none rounded-lg border border-[#DCE3EC] bg-white px-2 py-2 text-[9.5px] font-semibold outline-none focus:border-[#B54B5A]" />
                              <button name="decision" value="reject" className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#E6C5CB] bg-[#FFF7F8] text-[9.5px] font-black text-[#A43E50]">
                                <XCircle className="h-3.5 w-3.5" /> Reject listing
                              </button>
                            </form>
                          </details>
                        ) : (
                          <div className="flex items-center gap-2 text-[10px] font-bold text-[#667287]">
                            {row.status === "live" ? <ShieldCheck className="h-4 w-4 text-[#147A55]" /> : <XCircle className="h-4 w-4 text-[#A43E50]" />}
                            {row.status === "live" ? "Published" : "Rejected"}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length ? (
                  <tr><td colSpan={6} className="px-5 py-14 text-center"><Clock3 className="mx-auto h-6 w-6 text-[#A1ABBA]" /><p className="mt-2 text-xs font-bold text-[#778297]">No listings in this view.</p></td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </ClaimManagerShell>
  );
}

function StatusTab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return <a href={href} className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-[10px] font-black transition-colors ${active ? "bg-[#17213E] text-white" : "text-[#5F6B81] hover:bg-[#F1F4F8]"}`}>{label}<span className={`rounded-full px-1.5 py-0.5 text-[9px] ${active ? "bg-white/15 text-white" : "bg-[#E9EEF6] text-[#53627B]"}`}>{count}</span></a>;
}

function StatusPill({ status }: { status: string }) {
  const live = status === "live";
  const rejected = status === "rejected";
  return <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${live ? "bg-[#EAF7F0] text-[#147A55]" : rejected ? "bg-[#FFF0F2] text-[#A43E50]" : "bg-[#FFF4DF] text-[#936100]"}`}>{status.replace("_", " ")}</span>;
}

function Signal({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black ${ok ? "bg-[#EDF8F2] text-[#167456]" : "bg-[#F3F5F8] text-[#7C8798]"}`}><span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-[#16A36B]" : "bg-[#AAB3C0]"}`} />{label}</span>;
}

function modeLabel(value: string) {
  if (value === "fixed_price") return "Fixed price";
  if (value === "managed_auction") return "Managed auction";
  return "Open to offers";
}

function money(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
