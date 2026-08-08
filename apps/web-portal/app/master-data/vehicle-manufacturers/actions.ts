"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { splitManufacturerTokens, vehicleManufacturerSlug } from "@/lib/vehicle-manufacturer-master";

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

function errorUrl(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

export async function saveVehicleManufacturer(id: string | null, formData: FormData) {
  const profile = await requireCapability("manage_master_data", "edit");
  if (!profile?.id) redirect("/access-denied");

  const basePath = id ? `/master-data/vehicle-manufacturers/${id}/edit` : "/master-data/vehicle-manufacturers/new";
  const name = text(formData, "name");
  const displayName = text(formData, "display_name");
  const manufacturerCode = text(formData, "manufacturer_code")?.toUpperCase();
  const slug = text(formData, "slug") || (displayName ? vehicleManufacturerSlug(displayName) : null);
  if (!name || !displayName || !manufacturerCode || !slug) {
    redirect(errorUrl(basePath, "Legal name, display name, manufacturer code and slug are required."));
  }

  const sortOrderInput = text(formData, "sort_order");
  const sortOrder = sortOrderInput && Number.isFinite(Number(sortOrderInput)) ? Number(sortOrderInput) : 1000;
  const segments = formData.getAll("segments").filter((value): value is string => typeof value === "string" && Boolean(value));
  const brands = splitManufacturerTokens(text(formData, "brands"));
  const aliases = splitManufacturerTokens(text(formData, "aliases"));
  if (!brands.length) brands.push(displayName);
  if (!aliases.some((alias) => alias.toLowerCase() === displayName.toLowerCase())) aliases.unshift(displayName);

  const payload = {
    name,
    display_name: displayName,
    manufacturer_code: manufacturerCode,
    slug,
    parent_group_name: text(formData, "parent_group_name"),
    country_of_origin: text(formData, "country_of_origin"),
    india_presence_type: text(formData, "india_presence_type"),
    website_url: text(formData, "website_url"),
    market_status: text(formData, "market_status") ?? "pending_review",
    logo_path: text(formData, "logo_path"),
    logo_source_url: text(formData, "logo_source_url"),
    logo_status: text(formData, "logo_status") ?? "missing",
    source_name: text(formData, "source_name"),
    source_url: text(formData, "source_url"),
    source_verified_at: text(formData, "source_verified_at"),
    is_active: checked(formData, "is_active"),
    sort_order: sortOrder,
  };

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("save_vehicle_manufacturer_master", {
    p_id: id,
    p_payload: payload,
    p_segments: segments,
    p_brands: brands,
    p_aliases: aliases,
    p_actor: profile.id,
  });

  if (error || !data) redirect(errorUrl(basePath, error?.message ?? "Unable to save vehicle manufacturer."));

  revalidatePath("/master-data/vehicle-manufacturers");
  revalidatePath(`/master-data/vehicle-manufacturers/${data}`);
  revalidatePath("/vehicles/new");
  revalidatePath("/customers/posp-misp");
  redirect(`/master-data/vehicle-manufacturers/${data}?success=${id ? "updated" : "created"}`);
}

export async function setVehicleManufacturerActive(id: string, active: boolean) {
  const profile = await requireCapability("manage_master_data", "edit");
  if (!profile?.id) redirect("/access-denied");

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("vehicle_manufacturers").update({ is_active: active, updated_by: profile.id }).eq("id", id);
  if (error) redirect(errorUrl(`/master-data/vehicle-manufacturers/${id}`, error.message));

  revalidatePath("/master-data/vehicle-manufacturers");
  revalidatePath(`/master-data/vehicle-manufacturers/${id}`);
  revalidatePath("/vehicles/new");
  redirect(`/master-data/vehicle-manufacturers/${id}?success=${active ? "activated" : "deactivated"}`);
}
