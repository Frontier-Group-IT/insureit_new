"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { INSURER_LOGO_BUCKET } from "@/lib/insurer-logo";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const INSURER_MASTER_PATH = "/master-data/insurance-companies";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const segments = ["general", "life", "health"] as const;
type InsurerSegment = (typeof segments)[number];
type PortalStatus = "configured" | "pending" | "not_provided";
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ExistingInsurer = {
  id: string;
  name: string;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function errorUrl(path: string, message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}error=${encodeURIComponent(message)}`;
}

function segmentValue(formData: FormData): InsurerSegment | null {
  const value = text(formData, "segment");
  return value && segments.includes(value as InsurerSegment) ? value as InsurerSegment : null;
}

function portalStatusValue(formData: FormData): PortalStatus {
  const value = text(formData, "portal_status");
  return value === "configured" || value === "pending" || value === "not_provided" ? value : "not_provided";
}

function portalUrlValue(formData: FormData, status: PortalStatus) {
  const raw = text(formData, "portal_url");
  if (status !== "configured") return null;
  if (!raw) throw new Error("Enter the insurer portal URL or change the portal status.");
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const parsed = new URL(normalized);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Enter a valid HTTP or HTTPS portal URL.");
  return parsed.toString();
}

function logoFile(formData: FormData) {
  const value = formData.get("logo");
  if (!value || typeof value === "string" || value.size === 0) return null;
  if (!LOGO_MIME_EXTENSIONS[value.type]) throw new Error("Logo must be a PNG, JPG or WebP image.");
  if (value.size > MAX_LOGO_BYTES) throw new Error("Logo must be 2 MB or smaller.");
  return value;
}

async function uploadInsurerLogo(admin: AdminClient, insurerId: string, file: File) {
  const extension = LOGO_MIME_EXTENSIONS[file.type];
  const path = `${insurerId}/${randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await admin.storage.from(INSURER_LOGO_BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(`Logo upload failed: ${error.message}`);
  return path;
}

async function removeManagedLogo(admin: AdminClient, insurerId: string, path: string | null | undefined) {
  if (!path || !path.startsWith(`${insurerId}/`)) return;
  const { error } = await admin.storage.from(INSURER_LOGO_BUCKET).remove([path]);
  if (error) console.error("Insurance company logo cleanup failed", { insurerId, error: error.message });
}

async function auditInsurerChange(
  actorId: string | null | undefined,
  action: string,
  recordId: string,
  oldData: Record<string, unknown> | null,
  newData: Record<string, unknown> | null,
) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_id: actorId ?? null,
    action,
    table_name: "insurance_companies",
    record_id: recordId,
    old_data: oldData,
    new_data: newData,
  });
  if (error) console.error("Insurance company audit log failed", { action, recordId, error: error.message });
}

function buildPayload(formData: FormData) {
  const name = text(formData, "name");
  const segment = segmentValue(formData);
  const sibplCode = text(formData, "sibpl_code");
  const portalStatus = portalStatusValue(formData);

  if (!name) throw new Error("Enter the full registered insurance company name.");
  if (!segment) throw new Error("Select the insurance segment.");

  return {
    name,
    segment,
    sibpl_code: sibplCode,
    portal_url: portalUrlValue(formData, portalStatus),
    portal_status: portalStatus,
    is_active: formData.get("is_active") === "on",
    updated_at: new Date().toISOString(),
  };
}

export async function createInsuranceCompanyMaster(formData: FormData) {
  const profile = await requireCapability("manage_master_data", "edit");
  const basePath = `${INSURER_MASTER_PATH}/new`;
  let payload: ReturnType<typeof buildPayload>;
  let logo: File | null;
  try {
    payload = buildPayload(formData);
    logo = logoFile(formData);
  } catch (error) {
    redirect(errorUrl(basePath, error instanceof Error ? error.message : "Review the insurer details."));
  }

  const admin = createSupabaseAdminClient();
  const { data: duplicate, error: duplicateError } = await admin
    .from("insurance_companies")
    .select("id,name")
    .ilike("name", payload.name)
    .limit(1)
    .maybeSingle<ExistingInsurer>();

  if (duplicateError) redirect(errorUrl(basePath, `Unable to check insurer master: ${duplicateError.message}`));
  if (duplicate) redirect(errorUrl(basePath, "An insurance company with this registered name already exists."));

  const insurerId = randomUUID();
  let logoPath: string | null = null;
  if (logo) {
    try {
      logoPath = await uploadInsurerLogo(admin, insurerId, logo);
    } catch (error) {
      redirect(errorUrl(basePath, error instanceof Error ? error.message : "Logo could not be uploaded."));
    }
  }

  const { data, error } = await admin
    .from("insurance_companies")
    .insert({ id: insurerId, ...payload, logo_path: logoPath })
    .select("id,name,segment,sibpl_code,portal_url,portal_status,is_active,logo_path")
    .single<Record<string, unknown> & { id: string }>();

  if (error || !data) {
    await removeManagedLogo(admin, insurerId, logoPath);
    redirect(errorUrl(basePath, `Insurance company could not be created: ${error?.message ?? "Unknown error"}`));
  }

  await auditInsurerChange(profile?.id, "insurance_company_created", data.id, null, data);
  revalidateTag("reference:insurance-companies");
  revalidatePath(INSURER_MASTER_PATH);
  revalidatePath("/insurance-companies");
  revalidatePath("/policies/new");
  redirect(`${INSURER_MASTER_PATH}/${data.id}?success=created`);
}

export async function updateInsuranceCompanyMaster(id: string, formData: FormData) {
  const profile = await requireCapability("manage_master_data", "edit");
  const basePath = `${INSURER_MASTER_PATH}/${id}/edit`;
  let payload: ReturnType<typeof buildPayload>;
  let logo: File | null;
  try {
    payload = buildPayload(formData);
    logo = logoFile(formData);
  } catch (error) {
    redirect(errorUrl(basePath, error instanceof Error ? error.message : "Review the insurer details."));
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("insurance_companies")
    .select("id,name,segment,sibpl_code,portal_url,portal_status,is_active,logo_path")
    .eq("id", id)
    .maybeSingle<Record<string, unknown> & { id: string; logo_path?: string | null }>();

  if (existingError) redirect(errorUrl(basePath, `Unable to load insurer: ${existingError.message}`));
  if (!existing) redirect(`${INSURER_MASTER_PATH}?error=Insurance%20company%20not%20found`);

  const { data: duplicate, error: duplicateError } = await admin
    .from("insurance_companies")
    .select("id,name")
    .ilike("name", payload.name)
    .neq("id", id)
    .limit(1)
    .maybeSingle<ExistingInsurer>();

  if (duplicateError) redirect(errorUrl(basePath, `Unable to check insurer master: ${duplicateError.message}`));
  if (duplicate) redirect(errorUrl(basePath, "Another insurance company already uses this registered name."));

  let uploadedPath: string | null = null;
  if (logo) {
    try {
      uploadedPath = await uploadInsurerLogo(admin, id, logo);
    } catch (error) {
      redirect(errorUrl(basePath, error instanceof Error ? error.message : "Logo could not be uploaded."));
    }
  }

  const removeLogo = formData.get("remove_logo") === "on";
  const oldLogoPath = existing.logo_path ?? null;
  const nextLogoPath = uploadedPath ?? (removeLogo ? null : oldLogoPath);

  const { data, error } = await admin
    .from("insurance_companies")
    .update({ ...payload, logo_path: nextLogoPath })
    .eq("id", id)
    .select("id,name,segment,sibpl_code,portal_url,portal_status,is_active,logo_path")
    .single<Record<string, unknown> & { id: string }>();

  if (error || !data) {
    await removeManagedLogo(admin, id, uploadedPath);
    redirect(errorUrl(basePath, `Insurance company could not be updated: ${error?.message ?? "Unknown error"}`));
  }

  if (oldLogoPath && oldLogoPath !== nextLogoPath) await removeManagedLogo(admin, id, oldLogoPath);

  await auditInsurerChange(profile?.id, "insurance_company_updated", id, existing, data);
  revalidateTag("reference:insurance-companies");
  revalidatePath(INSURER_MASTER_PATH);
  revalidatePath("/insurance-companies");
  revalidatePath(`${INSURER_MASTER_PATH}/${id}`);
  revalidatePath(`/insurance-companies/${id}`);
  revalidatePath("/policies/new");
  redirect(`${INSURER_MASTER_PATH}/${id}?success=updated`);
}

export async function setInsuranceCompanyActive(id: string, nextActive: boolean) {
  const profile = await requireCapability("manage_master_data", "edit");
  const admin = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("insurance_companies")
    .select("id,name,is_active")
    .eq("id", id)
    .maybeSingle<{ id: string; name: string; is_active: boolean }>();

  if (existingError || !existing) redirect(errorUrl(INSURER_MASTER_PATH, existingError?.message ?? "Insurance company not found."));

  const { data, error } = await admin
    .from("insurance_companies")
    .update({ is_active: nextActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id,name,is_active")
    .single<{ id: string; name: string; is_active: boolean }>();

  if (error || !data) redirect(errorUrl(`${INSURER_MASTER_PATH}/${id}`, `Status could not be updated: ${error?.message ?? "Unknown error"}`));

  await auditInsurerChange(profile?.id, nextActive ? "insurance_company_activated" : "insurance_company_deactivated", id, existing, data);
  revalidateTag("reference:insurance-companies");
  revalidatePath(INSURER_MASTER_PATH);
  revalidatePath("/insurance-companies");
  revalidatePath(`${INSURER_MASTER_PATH}/${id}`);
  revalidatePath(`/insurance-companies/${id}`);
  revalidatePath("/policies/new");
  redirect(`${INSURER_MASTER_PATH}/${id}?success=${nextActive ? "activated" : "deactivated"}`);
}
