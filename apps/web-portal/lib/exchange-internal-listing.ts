import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const allowedRoles = new Set(["it_super_user", "super_admin", "sales_operations_head"]);
const guidedPhotoLabels = ["Front", "Rear", "Left", "Right", "Cabin", "Odometer"] as const;
const activeStatuses = ["pending_review", "live", "paused", "deal_in_progress"];
const editableStatuses = ["draft", "rejected", "paused"];

export type InternalExchangeActor = { id: string; role: string; full_name?: string | null };

export async function requireInternalExchangeLister(): Promise<InternalExchangeActor> {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || !allowedRoles.has(String(profile.role))) throw new Error("Exchange listing creation access required.");
  if (!(await hasEffectiveCapability(profile, "create_exchange_listings", "edit"))) throw new Error("Exchange listing creation access required.");
  return { id: profile.id, role: String(profile.role), full_name: profile.full_name };
}

export async function listInternalExchangeCustomers() {
  await requireInternalExchangeLister();
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("customers")
    .select("id,customer_code,company_name,contact_name,phone,city,state")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Customers could not be loaded.");
  return data ?? [];
}

export async function loadInternalExchangeCustomerContext(customerId: string) {
  await requireInternalExchangeLister();
  const admin = createSupabaseAdminClient();
  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id,customer_code,company_name,contact_name,phone,city,state")
    .eq("id", customerId)
    .maybeSingle();
  if (customerError || !customer) throw new Error("Customer could not be found.");

  const { data: vehicles, error: vehicleError } = await admin
    .from("vehicles")
    .select("id,customer_id,vehicle_no,make,model,year,vehicle_type,vehicle_category,fuel_type,body_type,updated_at")
    .eq("customer_id", customerId)
    .order("updated_at", { ascending: false });
  if (vehicleError) throw new Error("Customer fleet could not be loaded.");

  const vehicleIds = (vehicles ?? []).map((item) => item.id);
  const { data: listings } = vehicleIds.length
    ? await admin
      .from("exchange_listings")
      .select("id,listing_no,vehicle_id,status,title,category,odometer_km,asking_price,selling_mode,tyre_condition_percent,condition_details,review_notes,created_at")
      .in("vehicle_id", vehicleIds)
      .in("status", [...activeStatuses, ...editableStatuses])
      .order("created_at", { ascending: false })
    : { data: [] as Array<Record<string, unknown>> };

  const listingRows = listings ?? [];
  const listingIds = listingRows.map((row) => String(row.id));
  const { data: media } = listingIds.length
    ? await admin
      .from("exchange_listing_media")
      .select("id,listing_id,label,storage_bucket,storage_path,is_cover,sort_order")
      .in("listing_id", listingIds)
      .eq("media_type", "photo")
      .order("sort_order")
    : { data: [] as Array<Record<string, unknown>> };

  const signed = new Map<string, string | null>();
  await Promise.all((media ?? []).map(async (item) => {
    const { data } = await admin.storage.from(String(item.storage_bucket)).createSignedUrl(String(item.storage_path), 3600);
    signed.set(String(item.id), data?.signedUrl ?? null);
  }));

  return {
    customer,
    vehicles: (vehicles ?? []).map((vehicle) => {
      const related = listingRows.filter((row) => row.vehicle_id === vehicle.id);
      const active = related.find((row) => activeStatuses.includes(String(row.status)));
      const editable = related.find((row) => editableStatuses.includes(String(row.status)));
      const editableMedia = editable
        ? (media ?? []).filter((item) => item.listing_id === editable.id).map((item) => ({
          id: item.id,
          label: item.label,
          url: signed.get(String(item.id)) ?? null,
          is_cover: item.is_cover,
          sort_order: item.sort_order,
        }))
        : [];
      return {
        ...vehicle,
        city: customer.city,
        state: customer.state,
        has_active_listing: Boolean(active),
        active_listing_no: active?.listing_no ?? null,
        editable_listing: editable ? { ...editable, media: editableMedia } : null,
      };
    }),
  };
}

function validCategory(value: string) {
  return ["Truck", "Tipper", "Pickup", "Bus", "Construction", "Other"].includes(value);
}

function validSellingMode(value: string) {
  return ["fixed_price", "open_bidding", "managed_auction"].includes(value);
}

export async function saveInternalExchangeDraft(input: {
  listingId?: string | null;
  customerId: string;
  vehicleId: string;
  title: string;
  category: string;
  odometerKm: number;
  askingPrice: number;
  sellingMode: string;
  tyreConditionPercent?: number | null;
  conditionDetails?: Record<string, unknown>;
}) {
  const actor = await requireInternalExchangeLister();
  const admin = createSupabaseAdminClient();

  if (!input.customerId || !input.vehicleId) throw new Error("Select a customer and vehicle.");
  if (!validCategory(input.category)) throw new Error("Select a valid marketplace category.");
  if (!validSellingMode(input.sellingMode)) throw new Error("Select a valid selling mode.");
  if (!Number.isFinite(input.odometerKm) || input.odometerKm < 0) throw new Error("Enter a valid odometer reading.");
  if (!Number.isFinite(input.askingPrice) || input.askingPrice <= 0) throw new Error("Enter a valid expected price.");
  if (input.tyreConditionPercent != null && (!Number.isInteger(input.tyreConditionPercent) || input.tyreConditionPercent < 0 || input.tyreConditionPercent > 100)) {
    throw new Error("Tyre condition must be between 0 and 100%.");
  }

  const [{ data: customer }, { data: vehicle }] = await Promise.all([
    admin.from("customers").select("id,city,state").eq("id", input.customerId).maybeSingle(),
    admin.from("vehicles").select("id,customer_id,vehicle_no,make,model,year").eq("id", input.vehicleId).eq("customer_id", input.customerId).maybeSingle(),
  ]);
  if (!customer || !vehicle) throw new Error("The selected vehicle does not belong to this customer.");

  let activeQuery = admin
    .from("exchange_listings")
    .select("id,listing_no,status")
    .eq("vehicle_id", input.vehicleId)
    .in("status", activeStatuses);
  if (input.listingId) activeQuery = activeQuery.neq("id", input.listingId);
  const { data: active } = await activeQuery.limit(1);
  if (active?.length) throw new Error(`This vehicle already has an active Exchange listing (${active[0].listing_no}).`);

  const values = {
    seller_customer_id: input.customerId,
    vehicle_id: input.vehicleId,
    title: input.title.trim() || [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Commercial vehicle",
    category: input.category,
    city: customer.city,
    state: customer.state,
    odometer_km: Math.trunc(input.odometerKm),
    asking_price: input.askingPrice,
    opening_bid: input.sellingMode === "managed_auction" ? input.askingPrice : 0,
    min_bid_increment: 10000,
    tyre_condition_percent: input.tyreConditionPercent ?? null,
    condition_details: input.conditionDetails ?? {},
    seller_declaration: { created_via: "operations_web", created_by_profile_id: actor.id },
    selling_mode: input.sellingMode,
    review_notes: null,
  };

  let listing: any = null;
  if (input.listingId) {
    const { data: current } = await admin
      .from("exchange_listings")
      .select("id,status,seller_customer_id,vehicle_id")
      .eq("id", input.listingId)
      .maybeSingle();
    if (!current || !editableStatuses.includes(String(current.status))) throw new Error("This listing can no longer be edited.");
    if (current.seller_customer_id !== input.customerId || current.vehicle_id !== input.vehicleId) throw new Error("Listing ownership does not match the selected customer and vehicle.");
    const { data, error } = await admin.from("exchange_listings").update({ ...values, status: "draft" }).eq("id", input.listingId).select("id,listing_no,status").single();
    if (error) throw new Error(error.message || "Listing draft could not be saved.");
    listing = data;
    await admin.from("exchange_events").insert({ listing_id: listing.id, actor_profile_id: actor.id, actor_customer_id: input.customerId, event_type: "listing_draft_updated", metadata: { created_via: "operations_web" } });
  } else {
    const { data, error } = await admin.from("exchange_listings").insert({ ...values, seller_profile_id: actor.id, status: "draft" }).select("id,listing_no,status").single();
    if (error) throw new Error(error.message || "Listing draft could not be created.");
    listing = data;
    await admin.from("exchange_events").insert({ listing_id: listing.id, actor_profile_id: actor.id, actor_customer_id: input.customerId, event_type: "listing_draft_created", metadata: { created_via: "operations_web" } });
  }

  return listing;
}

export async function submitInternalExchangeListing(listingId: string) {
  const actor = await requireInternalExchangeLister();
  const admin = createSupabaseAdminClient();
  const { data: listing } = await admin
    .from("exchange_listings")
    .select("id,listing_no,status,seller_customer_id,asking_price,odometer_km")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) throw new Error("Listing not found.");
  if (!editableStatuses.includes(String(listing.status))) throw new Error("This listing cannot be submitted in its current status.");
  if (Number(listing.asking_price) <= 0) throw new Error("Expected price is required.");
  if (listing.odometer_km == null) throw new Error("Odometer reading is required.");

  const { data: media } = await admin
    .from("exchange_listing_media")
    .select("label,is_cover")
    .eq("listing_id", listingId)
    .eq("media_type", "photo");
  const labels = new Set((media ?? []).map((item) => String(item.label ?? "").toLowerCase()));
  const missing = guidedPhotoLabels.filter((label) => !labels.has(label.toLowerCase()));
  if (missing.length) throw new Error(`Add all 6 guided vehicle photos before submitting. Missing: ${missing.join(", ")}.`);
  if (!(media ?? []).some((item) => item.is_cover)) throw new Error("A cover photo is required before submitting the listing.");

  const { data, error } = await admin
    .from("exchange_listings")
    .update({ status: "pending_review", submitted_at: new Date().toISOString(), review_notes: null })
    .eq("id", listingId)
    .select("id,listing_no,status")
    .single();
  if (error) throw new Error(error.message || "Listing could not be submitted.");

  await admin.from("exchange_events").insert({
    listing_id: listingId,
    actor_profile_id: actor.id,
    actor_customer_id: listing.seller_customer_id,
    event_type: "listing_submitted",
    metadata: { created_via: "operations_web" },
  });

  return data;
}

export async function uploadInternalExchangePhoto(input: {
  listingId: string;
  label: string;
  file: File;
}) {
  const actor = await requireInternalExchangeLister();
  const admin = createSupabaseAdminClient();
  if (!guidedPhotoLabels.includes(input.label as (typeof guidedPhotoLabels)[number])) throw new Error("Invalid guided photo slot.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.file.type)) throw new Error("Upload a JPG, PNG or WebP image.");
  if (input.file.size <= 0 || input.file.size > 15 * 1024 * 1024) throw new Error("Photo must be smaller than 15 MB.");

  const { data: listing } = await admin
    .from("exchange_listings")
    .select("id,status,seller_customer_id")
    .eq("id", input.listingId)
    .maybeSingle();
  if (!listing || !editableStatuses.includes(String(listing.status))) throw new Error("This listing is not open for photo changes.");

  const extension = input.file.type === "image/png" ? "png" : input.file.type === "image/webp" ? "webp" : "jpg";
  const safeLabel = input.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const storagePath = `${input.listingId}/${safeLabel}-${Date.now()}.${extension}`;
  const bytes = await input.file.arrayBuffer();
  const { error: uploadError } = await admin.storage.from("exchange-media").upload(storagePath, bytes, { contentType: input.file.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message || "Photo could not be uploaded.");

  const { data: existing } = await admin
    .from("exchange_listing_media")
    .select("id,storage_bucket,storage_path")
    .eq("listing_id", input.listingId)
    .eq("media_type", "photo")
    .ilike("label", input.label);

  const cover = input.label === "Front";
  if (cover) await admin.from("exchange_listing_media").update({ is_cover: false }).eq("listing_id", input.listingId);

  const { data: media, error: mediaError } = await admin.from("exchange_listing_media").insert({
    listing_id: input.listingId,
    media_type: "photo",
    label: input.label,
    storage_bucket: "exchange-media",
    storage_path: storagePath,
    mime_type: input.file.type,
    file_size: input.file.size,
    sort_order: guidedPhotoLabels.indexOf(input.label as (typeof guidedPhotoLabels)[number]),
    is_cover: cover,
    uploaded_by: actor.id,
  }).select("id,label,storage_bucket,storage_path,is_cover,sort_order").single();

  if (mediaError) {
    await admin.storage.from("exchange-media").remove([storagePath]);
    throw new Error(mediaError.message || "Photo reference could not be saved.");
  }

  if (existing?.length) {
    await admin.from("exchange_listing_media").delete().in("id", existing.map((item) => item.id));
    const oldPaths = existing.filter((item) => item.storage_bucket === "exchange-media").map((item) => item.storage_path);
    if (oldPaths.length) await admin.storage.from("exchange-media").remove(oldPaths);
  }

  const { data: signed } = await admin.storage.from("exchange-media").createSignedUrl(storagePath, 3600);
  await admin.from("exchange_events").insert({
    listing_id: input.listingId,
    actor_profile_id: actor.id,
    actor_customer_id: listing.seller_customer_id,
    event_type: "listing_media_uploaded",
    metadata: { label: input.label, created_via: "operations_web" },
  });

  return { ...media, url: signed?.signedUrl ?? null };
}

export { guidedPhotoLabels };
