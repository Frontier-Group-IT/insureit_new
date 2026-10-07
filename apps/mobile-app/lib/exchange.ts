import { supabase } from './supabase';

export type ExchangeFeedRow = {
  listing_id: string;
  listing_no: string;
  title: string;
  category: 'Truck' | 'Tipper' | 'Pickup' | 'Bus' | 'Construction' | 'Other';
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
};

export type ExchangeSellableVehicle = {
  vehicle_id: string;
  vehicle_no: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vehicle_type: string;
  vehicle_category: string | null;
  fuel_type: string | null;
  body_type: string | null;
  city: string | null;
  state: string | null;
  has_active_listing: boolean;
};

export type ExchangeActivity = {
  favorites: Array<Record<string, unknown>>;
  bids: Array<Record<string, unknown>>;
  listings: Array<Record<string, unknown>>;
  deals: Array<Record<string, unknown>>;
  contact_requests: Array<Record<string, unknown>>;
};

export async function getExchangeMarketplaceFeed(input?: {
  category?: string | null;
  query?: string | null;
  limit?: number;
  offset?: number;
}) {
  const { data, error } = await (supabase.rpc as any)('exchange_marketplace_feed', {
    p_category: input?.category ?? null,
    p_query: input?.query ?? null,
    p_limit: input?.limit ?? 40,
    p_offset: input?.offset ?? 0,
  });
  if (error) throw error;
  const rows = (data ?? []) as ExchangeFeedRow[];
  return Promise.all(rows.map(async (row) => ({
    ...row,
    cover_url: await signedCoverUrl(row.cover_storage_bucket, row.cover_storage_path),
  })));
}

export async function getExchangeSellableVehicles(customerId: string) {
  const { data, error } = await (supabase.rpc as any)('exchange_my_sellable_vehicles', {
    p_customer_id: customerId,
  });
  if (error) throw error;
  return (data ?? []) as ExchangeSellableVehicle[];
}

export async function saveExchangeListingDraft(input: {
  listingId?: string | null;
  customerId: string;
  vehicleId: string;
  title: string;
  category: 'Truck' | 'Tipper' | 'Pickup' | 'Bus' | 'Construction' | 'Other';
  odometerKm: number;
  askingPrice: number;
  openingBid?: number;
  minBidIncrement?: number;
  ownershipCount?: number | null;
  tyreConditionPercent?: number | null;
  permitSummary?: string | null;
  financeSummary?: string | null;
  conditionDetails?: Record<string, unknown>;
  sellerDeclaration?: Record<string, unknown>;
}) {
  const { data, error } = await (supabase.rpc as any)('exchange_upsert_listing_draft', {
    p_listing_id: input.listingId ?? null,
    p_customer_id: input.customerId,
    p_vehicle_id: input.vehicleId,
    p_title: input.title,
    p_category: input.category,
    p_odometer_km: input.odometerKm,
    p_asking_price: input.askingPrice,
    p_opening_bid: input.openingBid ?? 0,
    p_min_bid_increment: input.minBidIncrement ?? 10000,
    p_ownership_count: input.ownershipCount ?? null,
    p_tyre_condition_percent: input.tyreConditionPercent ?? null,
    p_permit_summary: input.permitSummary ?? null,
    p_finance_summary: input.financeSummary ?? null,
    p_condition_details: input.conditionDetails ?? {},
    p_seller_declaration: input.sellerDeclaration ?? {},
  });
  if (error) throw error;
  return data;
}

export async function submitExchangeListing(listingId: string) {
  const { data, error } = await (supabase.rpc as any)('exchange_submit_listing', {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return data;
}

export async function toggleExchangeFavorite(listingId: string, customerId: string) {
  const { data, error } = await (supabase.rpc as any)('exchange_toggle_favorite', {
    p_listing_id: listingId,
    p_customer_id: customerId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function placeExchangeBid(listingId: string, customerId: string, amount: number) {
  const { data, error } = await (supabase.rpc as any)('exchange_place_bid', {
    p_listing_id: listingId,
    p_buyer_customer_id: customerId,
    p_amount: amount,
  });
  if (error) throw error;
  return data;
}

export async function requestExchangeContact(
  listingId: string,
  customerId: string,
  requestType: 'managed_callback' | 'inspection_visit' | 'ask_question' = 'managed_callback',
  message?: string | null,
) {
  const { data, error } = await (supabase.rpc as any)('exchange_request_contact', {
    p_listing_id: listingId,
    p_buyer_customer_id: customerId,
    p_request_type: requestType,
    p_message: message ?? null,
  });
  if (error) throw error;
  return data;
}

export async function respondExchangeContactRequest(requestId: string, accept: boolean) {
  const { data, error } = await (supabase.rpc as any)('exchange_respond_contact_request', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw error;
  return data;
}

export async function acceptExchangeLeadingBid(listingId: string) {
  const { data, error } = await (supabase.rpc as any)('exchange_accept_leading_bid', {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return data;
}

export async function confirmExchangeDeal(dealId: string) {
  const { data, error } = await (supabase.rpc as any)('exchange_confirm_deal', {
    p_deal_id: dealId,
  });
  if (error) throw error;
  return data;
}

export async function getExchangeActivity(customerId: string): Promise<ExchangeActivity> {
  const { data, error } = await (supabase.rpc as any)('exchange_my_activity', {
    p_customer_id: customerId,
  });
  if (error) throw error;
  const row = (data ?? {}) as Partial<ExchangeActivity>;
  return {
    favorites: Array.isArray(row.favorites) ? row.favorites : [],
    bids: Array.isArray(row.bids) ? row.bids : [],
    listings: Array.isArray(row.listings) ? row.listings : [],
    deals: Array.isArray(row.deals) ? row.deals : [],
    contact_requests: Array.isArray(row.contact_requests) ? row.contact_requests : [],
  };
}

export async function getExchangeSellerBidBook(listingId: string) {
  const { data, error } = await (supabase.rpc as any)('exchange_seller_bid_book', {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return data ?? [];
}

export async function withdrawExchangeListing(listingId: string) {
  const { data, error } = await (supabase.rpc as any)('exchange_withdraw_listing', {
    p_listing_id: listingId,
  });
  if (error) throw error;
  return data;
}

export async function registerExchangeListingMedia(input: {
  listingId: string;
  storagePath: string;
  mediaType?: 'photo' | 'video';
  label?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  sortOrder?: number;
  isCover?: boolean;
}) {
  const { data, error } = await (supabase.rpc as any)('exchange_register_listing_media', {
    p_listing_id: input.listingId,
    p_storage_path: input.storagePath,
    p_media_type: input.mediaType ?? 'photo',
    p_label: input.label ?? null,
    p_mime_type: input.mimeType ?? null,
    p_file_size: input.fileSize ?? null,
    p_sort_order: input.sortOrder ?? 0,
    p_is_cover: input.isCover ?? false,
  });
  if (error) throw error;
  return data;
}

export async function uploadExchangePhoto(input: {
  listingId: string;
  uri: string;
  label?: string | null;
  mimeType?: string | null;
  sortOrder?: number;
  isCover?: boolean;
}) {
  const extension = extensionFromMime(input.mimeType) ?? extensionFromUri(input.uri) ?? 'jpg';
  const objectName = `${input.listingId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
  const response = await fetch(input.uri);
  if (!response.ok) throw new Error('Could not read the selected photo.');
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('exchange-media')
    .upload(objectName, blob, {
      contentType: input.mimeType ?? blob.type ?? 'image/jpeg',
      upsert: false,
    });
  if (uploadError) throw uploadError;

  try {
    return await registerExchangeListingMedia({
      listingId: input.listingId,
      storagePath: objectName,
      mediaType: 'photo',
      label: input.label,
      mimeType: input.mimeType ?? blob.type ?? 'image/jpeg',
      fileSize: blob.size,
      sortOrder: input.sortOrder ?? 0,
      isCover: input.isCover ?? false,
    });
  } catch (error) {
    await supabase.storage.from('exchange-media').remove([objectName]);
    throw error;
  }
}

async function signedCoverUrl(bucket: string | null, path: string | null) {
  if (!bucket || !path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

function extensionFromMime(mimeType?: string | null) {
  if (!mimeType) return null;
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  return null;
}

function extensionFromUri(uri: string) {
  const match = uri.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
  return match?.[1]?.toLowerCase() ?? null;
}
