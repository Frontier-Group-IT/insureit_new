"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { splitManufacturerTokens, vehicleManufacturerSlug, VEHICLE_MANUFACTURER_LOGO_BUCKET } from "@/lib/vehicle-manufacturer-master";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

function text(formData: FormData, name: string) { const value = formData.get(name); return typeof value === "string" && value.trim() ? value.trim() : null; }
function checked(formData: FormData, name: string) { return formData.get(name) === "on" || formData.get(name) === "true"; }
function errorUrl(path: string, message: string) { const separator = path.includes("?") ? "&" : "?"; return `${path}${separator}error=${encodeURIComponent(message)}`; }

function logoFile(formData: FormData) {
  const value = formData.get("logo");
  if (!value || typeof value === "string" || value.size === 0) return null;
  if (!LOGO_MIME_EXTENSIONS[value.type]) throw new Error("Logo must be a PNG, JPG or WebP image.");
  if (value.size > MAX_LOGO_BYTES) throw new Error("Logo must be 2 MB or smaller.");
  return value;
}

async function uploadManufacturerLogo(admin: AdminClient, file: File) {
  const extension = LOGO_MIME_EXTENSIONS[file.type];
  const objectPath = `${randomUUID()}/${randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from(VEHICLE_MANUFACTURER_LOGO_BUCKET).upload(objectPath, bytes, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(`Logo upload failed: ${error.message}`);
  return { objectPath, logoUrl: `/api/manufacturer-logo?path=${encodeURIComponent(objectPath)}&v=${randomUUID()}` };
}

function managedObjectPath(logoUrl: string | null | undefined) {
  if (!logoUrl?.startsWith("/api/manufacturer-logo?")) return null;
  const query = logoUrl.split("?")[1] ?? "";
  return new URLSearchParams(query).get("path");
}

async function removeManagedLogo(admin: AdminClient, logoUrl: string | null | undefined) {
  const path = managedObjectPath(logoUrl);
  if (!path) return;
  const { error } = await admin.storage.from(VEHICLE_MANUFACTURER_LOGO_BUCKET).remove([path]);
  if (error) console.error("Vehicle manufacturer logo cleanup failed", { path, error: error.message });
}

export async function saveVehicleManufacturer(id: string | null, formData: FormData) {
  const profile = await requireCapability("manage_master_data", "edit");
  if (!profile?.id) redirect("/access-denied");
  const basePath = id ? `/master-data/vehicle-manufacturers/${id}/edit` : "/master-data/vehicle-manufacturers/new";
  const name = text(formData, "name");
  const displayName = text(formData, "display_name");
  const manufacturerCode = text(formData, "manufacturer_code")?.toUpperCase();
  const slug = text(formData, "slug") || (displayName ? vehicleManufacturerSlug(displayName) : null);
  if (!name || !displayName || !manufacturerCode || !slug) redirect(errorUrl(basePath, "Legal name, display name, manufacturer code and slug are required."));

  let logo: File | null;
  try { logo = logoFile(formData); } catch (error) { redirect(errorUrl(basePath, error instanceof Error ? error.message : "Review the manufacturer logo.")); }

  const admin = createSupabaseAdminClient();
  let oldLogoPath: string | null = null;
  if (id) {
    const { data: existing, error: existingError } = await admin.from("vehicle_manufacturers").select("logo_path").eq("id", id).maybeSingle<{ logo_path: string | null }>();
    if (existingError) redirect(errorUrl(basePath, `Unable to load existing manufacturer: ${existingError.message}`));
    oldLogoPath = existing?.logo_path ?? null;
  }

  let uploaded: { objectPath: string; logoUrl: string } | null = null;
  if (logo) {
    try { uploaded = await uploadManufacturerLogo(admin, logo); } catch (error) { redirect(errorUrl(basePath, error instanceof Error ? error.message : "Logo could not be uploaded.")); }
  }

  const removeLogo = formData.get("remove_logo") === "on";
  const fallbackLocalLogo = text(formData, "fallback_logo_path");
  const nextLogoPath = uploaded?.logoUrl ?? (removeLogo ? fallbackLocalLogo : oldLogoPath ?? fallbackLocalLogo);
  const sortOrderInput = text(formData, "sort_order");
  const sortOrder = sortOrderInput && Number.isFinite(Number(sortOrderInput)) ? Number(sortOrderInput) : 1000;
  const segments = formData.getAll("segments").filter((value): value is string => typeof value === "string" && Boolean(value));
  const brands = splitManufacturerTokens(text(formData, "brands"));
  const aliases = splitManufacturerTokens(text(formData, "aliases"));
  if (!brands.length) brands.push(displayName);
  if (!aliases.some((alias) => alias.toLowerCase() === displayName.toLowerCase())) aliases.unshift(displayName);

  const payload = {
    name, display_name: displayName, manufacturer_code: manufacturerCode, slug,
    parent_group_name: text(formData, "parent_group_name"), country_of_origin: text(formData, "country_of_origin"), india_presence_type: text(formData, "india_presence_type"), website_url: text(formData, "website_url"),
    market_status: text(formData, "market_status") ?? "pending_review", logo_path: nextLogoPath, logo_source_url: text(formData, "logo_source_url"), logo_status: nextLogoPath ? "verified" : (text(formData, "logo_status") ?? "missing"),
    source_name: text(formData, "source_name"), source_url: text(formData, "source_url"), source_verified_at: text(formData, "source_verified_at"), is_active: checked(formData, "is_active"), sort_order: sortOrder,
  };

  const { data, error } = await admin.rpc("save_vehicle_manufacturer_master", { p_id: id, p_payload: payload, p_segments: segments, p_brands: brands, p_aliases: aliases, p_actor: profile.id });
  const savedId = typeof data === "string" ? data : null;
  if (error || !savedId) {
    if (uploaded) await admin.storage.from(VEHICLE_MANUFACTURER_LOGO_BUCKET).remove([uploaded.objectPath]);
    redirect(errorUrl(basePath, error?.message ?? "Unable to save vehicle manufacturer."));
  }
  if ((uploaded || removeLogo) && oldLogoPath && oldLogoPath !== nextLogoPath) await removeManagedLogo(admin, oldLogoPath);

  revalidateTag("reference:vehicle-manufacturers");
  revalidatePath("/master-data/vehicle-manufacturers");
  revalidatePath(`/master-data/vehicle-manufacturers/${savedId}`);
  revalidatePath("/vehicles/new");
  revalidatePath("/customers/posp-misp");
  redirect(`/master-data/vehicle-manufacturers/${savedId}?success=${id ? "updated" : "created"}`);
}

export async function setVehicleManufacturerActive(id: string, active: boolean, _formData?: FormData) {
  const profile = await requireCapability("manage_master_data", "edit");
  if (!profile?.id) redirect("/access-denied");
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("vehicle_manufacturers").update({ is_active: active, updated_by: profile.id }).eq("id", id);
  if (error) redirect(errorUrl(`/master-data/vehicle-manufacturers/${id}`, error.message));
  revalidateTag("reference:vehicle-manufacturers");
  revalidatePath("/master-data/vehicle-manufacturers");
  revalidatePath(`/master-data/vehicle-manufacturers/${id}`);
  revalidatePath("/vehicles/new");
  revalidatePath("/customers/posp-misp");
  redirect(`/master-data/vehicle-manufacturers/${id}?success=${active ? "activated" : "deactivated"}`);
}
