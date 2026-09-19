import "server-only";

import { enrichExternalRenewalOpportunity } from "@/lib/external-renewal-authbridge";
import { normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const TERMINAL_STATUSES = new Set(["won", "renewed_elsewhere", "invalid_contact", "do_not_contact", "lost", "duplicate"]);
const QUICK_ADD_SOURCE_NAME = "IT Voice Quick Add";

type ExistingOpportunity = {
  id: string;
  registration_no: string | null;
  opportunity_status: string;
  ai_profile_overrides: Record<string, unknown> | null;
};

function normalizedMobile(value: string) {
  const digits = value.replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9][0-9]{9}$/.test(ten) ? ten : null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function quickAddVoiceProspect({
  registrationNumber,
  mobile,
  requestedByAuthUserId,
}: {
  registrationNumber: string;
  mobile: string;
  requestedByAuthUserId: string;
}) {
  const admin = createSupabaseAdminClient();
  const normalizedRegistration = normalizeVehicleRegistrationNumber(registrationNumber);
  const normalizedPhone = normalizedMobile(mobile);

  if (!normalizedRegistration) throw new Error("Enter a valid RC number.");
  if (!normalizedPhone) throw new Error("Enter a valid 10-digit Indian mobile number.");

  const { data: publishedBatches, error: batchScopeError } = await admin
    .from("external_renewal_import_batches")
    .select("partner_id")
    .eq("status", "published")
    .limit(200)
    .returns<Array<{ partner_id: string }>>();

  if (batchScopeError) throw new Error("Could not resolve the External Renewal calling scope.");

  const partnerIds = [...new Set((publishedBatches ?? []).map((row) => row.partner_id).filter(Boolean))];
  if (partnerIds.length !== 1) {
    throw new Error(
      partnerIds.length === 0
        ? "Quick Add is not configured because no published External Renewal partner scope exists."
        : "Quick Add needs a single External Renewal partner scope before RC-only entry can be used.",
    );
  }

  const partnerId = partnerIds[0];

  const { data: activeOpportunities, error: activeError } = await admin
    .from("external_renewal_opportunities")
    .select("id,registration_no,opportunity_status,ai_profile_overrides")
    .eq("partner_id", partnerId)
    .eq("is_active", true)
    .not("registration_no", "is", null)
    .limit(2000)
    .returns<ExistingOpportunity[]>();

  if (activeError) throw new Error("Could not check the existing calling queue.");

  const existing = (activeOpportunities ?? []).find(
    (row) => normalizeVehicleRegistrationNumber(row.registration_no ?? "") === normalizedRegistration,
  );

  let opportunityId: string;
  let created = false;

  if (existing) {
    if (TERMINAL_STATUSES.has(existing.opportunity_status)) {
      throw new Error("This RC already exists in a closed or suppressed External Renewal prospect and cannot be re-added.");
    }

    const overrides =
      existing.ai_profile_overrides && typeof existing.ai_profile_overrides === "object"
        ? { ...existing.ai_profile_overrides }
        : {};
    overrides.mobile = normalizedPhone;

    const { error: promoteError } = await admin
      .from("external_renewal_opportunities")
      .update({
        voice_queue_source: "it_quick_add",
        quick_add_by_auth_user_id: requestedByAuthUserId,
        quick_added_at: new Date().toISOString(),
        ai_profile_overrides: overrides,
        ai_profile_updated_at: new Date().toISOString(),
        ai_profile_updated_by: requestedByAuthUserId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (promoteError) throw new Error("Could not add the existing prospect to the calling queue.");
    opportunityId = existing.id;
  } else {
    let batchId: string | null = null;

    const { data: existingBatch, error: quickBatchError } = await admin
      .from("external_renewal_import_batches")
      .select("id")
      .eq("partner_id", partnerId)
      .eq("source_name", QUICK_ADD_SOURCE_NAME)
      .eq("status", "validated")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (quickBatchError) throw new Error("Could not resolve the Quick Add source batch.");
    batchId = existingBatch?.id ?? null;

    if (!batchId) {
      const { data: createdBatch, error: createBatchError } = await admin
        .from("external_renewal_import_batches")
        .insert({
          partner_id: partnerId,
          source_name: QUICK_ADD_SOURCE_NAME,
          source_period: "IT-controlled voice queue",
          status: "validated",
          imported_by: requestedByAuthUserId,
        })
        .select("id")
        .single<{ id: string }>();

      if (createBatchError || !createdBatch) throw new Error("Could not create the Quick Add source batch.");
      batchId = createdBatch.id;
    }

    const { data: inserted, error: insertError } = await admin
      .from("external_renewal_opportunities")
      .insert({
        batch_id: batchId,
        partner_id: partnerId,
        mobile: normalizedPhone,
        registration_no: normalizedRegistration,
        invoice_date: todayIso(),
        opportunity_status: "new",
        is_active: true,
        source_payload: {
          entry_type: "it_voice_quick_add",
        },
        voice_queue_source: "it_quick_add",
        quick_add_by_auth_user_id: requestedByAuthUserId,
        quick_added_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError || !inserted) throw new Error("Could not create the Quick Add calling prospect.");
    opportunityId = inserted.id;
    created = true;
  }

  try {
    const enrichment = await enrichExternalRenewalOpportunity(opportunityId);
    return {
      opportunityId,
      created,
      enrichmentStatus: enrichment.status,
      enrichmentSource: enrichment.source,
    };
  } catch (error) {
    return {
      opportunityId,
      created,
      enrichmentStatus: "failed" as const,
      enrichmentSource: null,
      enrichmentError: error instanceof Error ? error.message : "RC details could not be fetched.",
    };
  }
}
