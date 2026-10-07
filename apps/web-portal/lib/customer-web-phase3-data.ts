import { cache } from "react";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/auth-server";

export type CustomerExchangeFeedRow = {
  listing_id: string;
  listing_no: string;
  title: string;
  category: "Truck" | "Tipper" | "Pickup" | "Bus" | "Construction" | "Other";
  selling_mode: "fixed_price" | "open_bidding" | "managed_auction";
  year: number | null;
  odometer_km: number | null;
  city: string | null;
  state: string | null;
  asking_price: number;
  current_bid: number;
  bid_count: number;
  min_bid_increment: number;
  auction_ends_at: string | null;
  owner_verified: boolean;
  documents_verified: boolean;
  inspected: boolean;
  inspection_score: number | null;
  masked_registration: string;
  fuel_type: string | null;
  ownership_count: number | null;
  tyre_condition_percent: number | null;
  permit_summary: string | null;
  finance_summary: string | null;
  make: string | null;
  model: string | null;
  vehicle_type: string | null;
  cover_storage_bucket: string | null;
  cover_storage_path: string | null;
  is_favorite: boolean;
  cover_url: string | null;
};

export type CustomerExchangeListingDetail = {
  listing_id: string;
  listing_no: string;
  selling_mode: "fixed_price" | "open_bidding" | "managed_auction";
  registration_status: string | null;
  registration_status_as_on: string | null;
  registration_date: string | null;
  fitness_expiry_date: string | null;
  puc_expiry_date: string | null;
  road_tax_expiry_date: string | null;
  permit_type: string | null;
  permit_valid_from: string | null;
  national_permit_expiry_date: string | null;
  local_permit_expiry_date: string | null;
  gvw_kg: number | null;
  unladen_weight_kg: number | null;
  wheel_base_mm: number | null;
  body_type: string | null;
  engine_capacity_cc: number | null;
  emission_norm: string | null;
  financed: boolean | null;
  financer_name: string | null;
  blacklist_status: string | null;
  authbridge_verified: boolean | null;
  authbridge_last_verified_at: string | null;
  insurance: { source?: string | null; end_date?: string | null; insurer_name?: string | null };
  media: Array<{
    id: string;
    media_type: "photo" | "video";
    label: string | null;
    storage_bucket: string;
    storage_path: string;
    mime_type: string | null;
    sort_order: number;
    is_cover: boolean;
    signed_url?: string | null;
  }>;
};

export type CustomerServiceActivity = {
  id: string;
  enquiry_no: string;
  service_type: "insurance_quote" | "challan_assistance" | "support_ticket";
  subject: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  vehicle_no: string | null;
  category: string | null;
  priority: string | null;
  claim_id: string | null;
  created_at: string;
  updated_at: string;
};

async function signedUrl(bucket: string | null, storagePath: string | null) {
  if (!bucket || !storagePath) return null;
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 3600);
  return error ? null : data.signedUrl;
}

export const loadCustomerExchangeFeed = cache(async (input?: { category?: string | null; query?: string | null }) => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase.rpc as any)("exchange_marketplace_feed", {
    p_category: input?.category && input.category !== "All" ? input.category : null,
    p_query: input?.query?.trim() || null,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw new Error("Exchange listings are temporarily unavailable.");
  const rows = (data ?? []) as CustomerExchangeFeedRow[];
  return Promise.all(rows.map(async (row) => ({
    ...row,
    cover_url: await signedUrl(row.cover_storage_bucket, row.cover_storage_path),
  })));
});

export async function loadCustomerExchangeListing(listingId: string) {
  const feed = await loadCustomerExchangeFeed();
  const listing = feed.find((item) => item.listing_id === listingId);
  if (!listing) notFound();

  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase.rpc as any)("exchange_listing_detail", { p_listing_id: listingId });
  const detail = error || !data || typeof data !== "object" ? null : data as CustomerExchangeListingDetail;
  if (detail?.media?.length) {
    detail.media = await Promise.all(detail.media.map(async (item) => ({
      ...item,
      signed_url: await signedUrl(item.storage_bucket, item.storage_path),
    })));
  }
  return { listing, detail };
}

export const loadCustomerServiceActivity = cache(async (customerId: string): Promise<CustomerServiceActivity[]> => {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("service_enquiries")
    .select("id,enquiry_no,service_type,subject,description,status,vehicle_no,category,priority,claim_id,created_at,updated_at")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Support activity is temporarily unavailable.");
  return (data ?? []) as CustomerServiceActivity[];
});

export async function loadCustomerServiceActivityDetail(customerId: string, enquiryId: string) {
  const activity = await loadCustomerServiceActivity(customerId);
  const item = activity.find((row) => row.id === enquiryId);
  if (!item) notFound();
  return item;
}

export function serviceActivityLabel(type: CustomerServiceActivity["service_type"]) {
  if (type === "insurance_quote") return "Insurance Quote";
  if (type === "challan_assistance") return "Challan Assistance";
  return "Support Ticket";
}

export function serviceActivityTone(status: CustomerServiceActivity["status"]) {
  if (status === "resolved" || status === "closed") return "active" as const;
  if (status === "in_progress") return "neutral" as const;
  return "due" as const;
}

export function formatCustomerCompactMoney(value: number) {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(value % 10000000 ? 2 : 0)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 ? 2 : 0)} L`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatCustomerCompactDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
