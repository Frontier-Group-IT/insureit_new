import "server-only";

import * as XLSX from "xlsx";

import { normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";
import { enrichExternalRenewalOpportunity } from "@/lib/external-renewal-authbridge";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const MAX_ROWS = 500;
const TERMINAL = new Set(["won", "renewed_elsewhere", "invalid_contact", "do_not_contact", "lost", "duplicate"]);
const RC_HEADERS = new Set(["rcno", "rcnumber", "registrationno", "registrationnumber", "vehicleno", "vehiclenumber"]);
const MOBILE_HEADERS = new Set(["mobileno", "mobilenumber", "mobile", "phone", "phonenumber", "contactnumber"]);
const SECOND_MOBILE_HEADERS = new Set(["secondnumber", "secondmobileno", "alternatemobile", "alternatephone"]);
const CUSTOMER_NAME_HEADERS = new Set(["customername", "insuredname", "ownername", "ownersdetailsownersname"]);
const MAKE_HEADERS = new Set(["manufacturer", "make", "vehiclemake", "vehicledetailsmakermanufacturer"]);
const MODEL_HEADERS = new Set(["model", "vehiclemodel", "makersclass", "vehicledetailsmodelmakersclass"]);
const INSURER_HEADERS = new Set(["insurer", "insurancecompany", "currentinsurer", "insurancedetailsinsurancecompany"]);
const POLICY_NUMBER_HEADERS = new Set(["policynumber", "policyno", "currentpolicynumber", "insurancedetailspolicynumber"]);
const POLICY_EXPIRY_HEADERS = new Set(["policyexpirydate", "insuranceupto", "insurancetodate", "insurancedetailsinsurancetodateinsuranceupto"]);

type ExistingOpportunity = {
  id: string;
  registration_no: string | null;
  opportunity_status: string;
  is_active: boolean;
  ai_profile_overrides: Record<string, unknown> | null;
  source_payload: Record<string, unknown> | null;
};

export type VoiceCampaignListRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  duplicate_rows: number;
  enriched_rows: number;
  started_at: string | null;
  created_at: string;
};

type VoiceCampaignDetailRow = VoiceCampaignListRow & {
  partner_id: string;
  source_batch_id: string | null;
  dispatch_completed_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

type VoiceCampaignMemberRow = {
  id: string;
  campaign_id: string;
  opportunity_id: string;
  source_row_number: number;
  import_status: string;
  hold_reason: string | null;
  enrichment_status: string;
  enrichment_error: string | null;
  dispatch_status: string;
  dispatch_error: string | null;
  created_at: string;
  updated_at: string;
};

type VoiceCampaignOpportunityRow = {
  id: string;
  registration_no: string | null;
  mobile: string | null;
  customer_name: string | null;
  contact_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  current_insurer: string | null;
  rc_enrichment_details: Record<string, unknown> | null;
  ai_profile_overrides: Record<string, unknown> | null;
};

type VoiceCampaignAttemptRow = {
  opportunity_id: string;
  submission_status: string;
  call_disposition: string | null;
  created_at: string;
};

type VoiceCampaignReportOpportunityRow = {
  id: string;
  registration_no: string | null;
  mobile: string | null;
  customer_name: string | null;
  contact_name: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  current_insurer: string | null;
  current_policy_no: string | null;
  policy_end_date: string | null;
  opportunity_status: string;
  rc_enrichment_details: Record<string, unknown> | null;
  ai_profile_overrides: Record<string, unknown> | null;
};

type VoiceCampaignReportAttemptRow = {
  id: string;
  opportunity_id: string;
  submission_status: string;
  connectivity_status: string | null;
  completion_status: string | null;
  retry_attempt: number;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  call_disposition: string | null;
  customer_interest: string | null;
  follow_up_required: boolean | null;
  follow_up_at: string | null;
  customer_objection: string | null;
  call_summary: string | null;
  created_at: string;
  updated_at: string;
};

type VoiceCampaignReportAttemptEventRow = {
  voice_attempt_id: string;
  failure_reason: string | null;
  created_at: string;
};

export type VoiceCampaignReportRow = {
  campaignName: string;
  campaignStatus: string;
  customerName: string | null;
  mobileNumber: string | null;
  registrationNumber: string | null;
  manufacturer: string | null;
  currentInsurer: string | null;
  currentPolicyNumber: string | null;
  policyExpiryDate: string | null;
  callAttemptNumber: number | null;
  customerAvailability: string;
  callDurationSeconds: number | null;
  connectivityStatus: string | null;
  completionStatus: string | null;
  submissionStatus: string;
  callDisposition: string | null;
  customerInterest: string | null;
  customerObjection: string | null;
  followUpRequired: string;
  followUpDateTime: string | null;
  followUpTimeConfidence: string;
  quoteRequested: string;
  humanAssistanceRequired: string;
  doNotContact: string;
  wrongPerson: string;
  alreadyRenewed: string;
  addOnInterest: string;
  mainConversationOutcome: string;
  callSummary: string | null;
  nextRecommendedAction: string;
  failureReason: string | null;
  lastUpdatedAt: string;
  conversationQualityFlag: string;
};

export type VoiceCampaignMemberView = VoiceCampaignMemberRow & {
  opportunityId: string;
  registrationNumber: string | null;
  mobile: string | null;
  customerName: string | null;
  vehicle: string | null;
  insurer: string | null;
  policyExpiryDate: string | null;
  attemptStatus: string | null;
  callDisposition: string | null;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeMobile(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const ten = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9][0-9]{9}$/.test(ten) ? ten : null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function maskMobile(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? "••••••" + digits.slice(-4) : "••••";
}

async function resolvePartnerId() {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("external_renewal_import_batches")
    .select("partner_id")
    .eq("status", "published")
    .limit(200)
    .returns<Array<{ partner_id: string }>>();

  if (error) throw new Error("Could not resolve the External Renewal campaign scope.");

  const ids = [...new Set((data ?? []).map((row) => row.partner_id).filter(Boolean))];
  if (ids.length !== 1) {
    throw new Error(
      ids.length
        ? "Voice campaigns require one External Renewal partner scope."
        : "No published External Renewal partner scope is configured.",
    );
  }
  return ids[0];
}

function normalizeDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const dmy = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const date = new Date(iso + "T00:00:00Z");
    return Number.isNaN(date.getTime()) ? null : iso;
  }

  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    const [, yyyy, mm, dd] = ymd;
    const iso = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    const date = new Date(iso + "T00:00:00Z");
    return Number.isNaN(date.getTime()) ? null : iso;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function cleanText(value: unknown) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text && !/^#?N\/?A$/i.test(text) ? text : null;
}

type ParsedCampaignRow = {
  sourceRowNumber: number;
  registrationNumber: string | null;
  mobile: string | null;
  secondaryMobile: string | null;
  customerName: string | null;
  manufacturer: string | null;
  model: string | null;
  currentInsurer: string | null;
  policyNumber: string | null;
  policyExpiryDate: string | null;
};

function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const tataSheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === "renewal");
  const candidateSheetName = tataSheetName ?? workbook.SheetNames[0];
  if (!candidateSheetName) throw new Error("The Excel file has no worksheet.");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[candidateSheetName], {
    header: 1,
    raw: false,
    defval: "",
  });
  if (!rows.length) throw new Error("The Excel file is empty.");

  const headers = rows[0].map(normalizeHeader);
  const rcIndex = headers.findIndex((value) => RC_HEADERS.has(value));
  const mobileIndex = headers.findIndex((value) => MOBILE_HEADERS.has(value));
  if (rcIndex < 0 || mobileIndex < 0) {
    throw new Error('Excel must contain the required fields "RC No./Registration Number" and "Mobile No./Contact Number".');
  }

  const find = (set: Set<string>) => headers.findIndex((value) => set.has(value));
  const secondMobileIndex = find(SECOND_MOBILE_HEADERS);
  const customerNameIndex = find(CUSTOMER_NAME_HEADERS);
  const makeIndex = find(MAKE_HEADERS);
  const modelIndex = find(MODEL_HEADERS);
  const insurerIndex = find(INSURER_HEADERS);
  const policyNumberIndex = find(POLICY_NUMBER_HEADERS);
  const policyExpiryIndex = find(POLICY_EXPIRY_HEADERS);

  const isTataRenewal =
    Boolean(tataSheetName) &&
    customerNameIndex >= 0 &&
    makeIndex >= 0 &&
    modelIndex >= 0 &&
    insurerIndex >= 0 &&
    policyExpiryIndex >= 0;

  const dataRows = rows
    .slice(1)
    .map((row, index) => ({ row, sourceRowNumber: index + 2 }))
    .filter(({ row }) => row.some((value) => String(value ?? "").trim()));
  if (!dataRows.length) throw new Error("The Excel file has no customer rows.");
  if (dataRows.length > MAX_ROWS) throw new Error(`A campaign can contain a maximum of ${MAX_ROWS} source rows.`);

  const parsed: ParsedCampaignRow[] = dataRows.map(({ row, sourceRowNumber }) => ({
    sourceRowNumber,
    registrationNumber: normalizeVehicleRegistrationNumber(String(row[rcIndex] ?? "")) || null,
    mobile: normalizeMobile(row[mobileIndex]),
    secondaryMobile: secondMobileIndex >= 0 ? normalizeMobile(row[secondMobileIndex]) : null,
    customerName: customerNameIndex >= 0 ? cleanText(row[customerNameIndex]) : null,
    manufacturer: makeIndex >= 0 ? cleanText(row[makeIndex]) : null,
    model: modelIndex >= 0 ? cleanText(row[modelIndex]) : null,
    currentInsurer: insurerIndex >= 0 ? cleanText(row[insurerIndex]) : null,
    policyNumber: policyNumberIndex >= 0 ? cleanText(row[policyNumberIndex]) : null,
    policyExpiryDate: policyExpiryIndex >= 0 ? normalizeDate(row[policyExpiryIndex]) : null,
  }));

  return {
    campaignType: isTataRenewal ? "tata_commercial_renewal" : "standard_renewal",
    sourceSheetName: candidateSheetName,
    rawRowCount: dataRows.length,
    rows: parsed,
  };
}

function groupTataRenewalRows(rows: ParsedCampaignRow[]) {
  const rejectedRows = rows.filter((row) => !row.registrationNumber || !(row.mobile || row.secondaryMobile));
  const groups = new Map<string, ParsedCampaignRow[]>();

  for (const row of rows) {
    if (!row.registrationNumber) continue;
    const mobile = row.mobile || row.secondaryMobile;
    if (!mobile) continue;
    const group = groups.get(mobile) ?? [];
    group.push({ ...row, mobile });
    groups.set(mobile, group);
  }

  const grouped = [...groups.entries()].map(([mobile, vehicles]) => {
    vehicles.sort((a, b) => {
      const aDate = a.policyExpiryDate ?? "9999-12-31";
      const bDate = b.policyExpiryDate ?? "9999-12-31";
      return aDate.localeCompare(bDate) || a.sourceRowNumber - b.sourceRowNumber;
    });
    const primary = vehicles[0];
    return {
      ...primary,
      mobile,
      vehicles: vehicles.map((vehicle) => ({
        registrationNumber: vehicle.registrationNumber,
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        currentInsurer: vehicle.currentInsurer,
        policyNumber: vehicle.policyNumber,
        policyExpiryDate: vehicle.policyExpiryDate,
      })),
    };
  });

  return {
    rows: grouped,
    rejectedCount: rejectedRows.length,
    groupedVehicleCount: grouped.reduce((count, row) => count + Math.max(row.vehicles.length - 1, 0), 0),
  };
}

function buildCampaignContext(
  campaignType: string,
  sourceSheetName: string,
  row: ParsedCampaignRow & { vehicles: Array<Record<string, unknown>> },
) {
  if (campaignType !== "tata_commercial_renewal") {
    return {
      campaignType,
      sourceSheet: sourceSheetName,
      customerName: row.customerName,
      manufacturer: row.manufacturer,
      model: row.model,
      currentInsurer: row.currentInsurer,
      policyNumber: row.policyNumber,
      policyExpiryDate: row.policyExpiryDate,
      vehicleCount: row.vehicles.length,
      vehicles: row.vehicles,
    };
  }

  return {
    campaignType,
    sourceSheet: "Renewal",
    callingBrand: "Frontier Trucks",
    vehicleBrandContext: "Tata Commercial",
    primarySalesPitch: "cashless_claim_support",
    cashlessClaimPitch:
      "हमारे through renewal कराने पर cashless claim process में end-to-end assistance हमारी main service benefit है. Exact cashless approval insurer और claim terms के according होता है.",
    customerName: row.customerName,
    manufacturer: row.manufacturer,
    model: row.model,
    currentInsurer: row.currentInsurer,
    policyNumber: row.policyNumber,
    policyExpiryDate: row.policyExpiryDate,
    vehicleCount: row.vehicles.length,
    vehicles: row.vehicles,
  };
}

export type VoiceCampaignListState = {
  campaigns: VoiceCampaignListRow[];
  schemaReady: boolean;
  error: string | null;
};

export async function getVoiceCampaignListState(limit = 12): Promise<VoiceCampaignListState> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("voice_campaigns")
    .select("id,name,description,status,total_rows,accepted_rows,rejected_rows,duplicate_rows,enriched_rows,started_at,created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50))
    .returns<VoiceCampaignListRow[]>();

  if (error) {
    return {
      campaigns: [],
      schemaReady: false,
      error: "Voice campaign schema is not ready.",
    };
  }

  return {
    campaigns: data ?? [],
    schemaReady: true,
    error: null,
  };
}

export async function getVoiceCampaigns(limit = 12) {
  const state = await getVoiceCampaignListState(limit);
  if (!state.schemaReady) throw new Error(state.error || "Voice campaigns are unavailable.");
  return state.campaigns;
}

export async function createVoiceCampaignFromWorkbook(input: {
  name: string;
  description?: string | null;
  fileName: string;
  fileBuffer: ArrayBuffer;
  requestedByAuthUserId: string;
}) {
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) throw new Error("Campaign name is required.");
  if (name.length > 120) throw new Error("Campaign name is too long.");
  if (!/\.(xlsx|xls|csv)$/i.test(input.fileName)) throw new Error("Upload an Excel (.xlsx/.xls) or CSV file.");
  if (input.fileBuffer.byteLength > 2_500_000) throw new Error("Campaign file is too large.");

  const parsedWorkbook = parseWorkbook(input.fileBuffer);
  const isTataRenewal = parsedWorkbook.campaignType === "tata_commercial_renewal";
  const tataGrouped = isTataRenewal ? groupTataRenewalRows(parsedWorkbook.rows) : null;
  const rows = tataGrouped?.rows ?? parsedWorkbook.rows.map((row) => ({ ...row, vehicles: [{
    registrationNumber: row.registrationNumber,
    manufacturer: row.manufacturer,
    model: row.model,
    currentInsurer: row.currentInsurer,
    policyNumber: row.policyNumber,
    policyExpiryDate: row.policyExpiryDate,
  }] }));
  const partnerId = await resolvePartnerId();
  const admin = createSupabaseAdminClient();

  const { data: campaign, error: campaignError } = await admin
    .from("voice_campaigns")
    .insert({
      partner_id: partnerId,
      name,
      description: input.description?.replace(/\s+/g, " ").trim().slice(0, 500) || null,
      status: "draft",
      total_rows: parsedWorkbook.rawRowCount,
      created_by_auth_user_id: input.requestedByAuthUserId,
    })
    .select("id")
    .single<{ id: string }>();

  if (campaignError || !campaign) throw new Error("Could not create the voice campaign.");

  const { data: batch, error: batchError } = await admin
    .from("external_renewal_import_batches")
    .insert({
      partner_id: partnerId,
      source_name: "IT Voice Campaign · " + name,
      source_file_name: input.fileName.slice(0, 200),
      source_period: isTataRenewal ? "Tata Commercial Renewal" : "IT-controlled voice campaign",
      status: "validated",
      total_rows: parsedWorkbook.rawRowCount,
      imported_by: input.requestedByAuthUserId,
    })
    .select("id")
    .single<{ id: string }>();

  if (batchError || !batch) throw new Error("Could not create the campaign source batch.");

  await admin.from("voice_campaigns").update({ source_batch_id: batch.id }).eq("id", campaign.id);

  const { data: existingRows, error: existingError } = await admin
    .from("external_renewal_opportunities")
    .select("id,registration_no,opportunity_status,is_active,ai_profile_overrides,source_payload")
    .eq("partner_id", partnerId)
    .not("registration_no", "is", null)
    .order("created_at", { ascending: false })
    .limit(10000)
    .returns<ExistingOpportunity[]>();

  if (existingError) throw new Error("Could not check existing renewal prospects.");

  const existingByRc = new Map<string, ExistingOpportunity>();
  for (const existing of existingRows ?? []) {
    const rc = normalizeVehicleRegistrationNumber(existing.registration_no ?? "");
    if (rc && !existingByRc.has(rc)) existingByRc.set(rc, existing);
  }

  const seen = new Set<string>();
  let accepted = 0;
  let rejected = tataGrouped?.rejectedCount ?? 0;
  let duplicates = tataGrouped?.groupedVehicleCount ?? 0;

  for (const row of rows) {
    if (!row.registrationNumber || !row.mobile) {
      if (!isTataRenewal) rejected += 1;
      continue;
    }

    if (seen.has(row.registrationNumber)) {
      if (!isTataRenewal) duplicates += 1;
      continue;
    }
    seen.add(row.registrationNumber);

    const existing = existingByRc.get(row.registrationNumber);

    if (existing && (TERMINAL.has(existing.opportunity_status) || !existing.is_active)) {
      duplicates += 1;
      await admin.from("voice_campaign_members").insert({
        campaign_id: campaign.id,
        opportunity_id: existing.id,
        source_row_number: row.sourceRowNumber,
        import_status: "held",
        hold_reason: "Existing RC is closed or suppressed.",
        enrichment_status: "held",
        dispatch_status: "held",
      });
      continue;
    }

    let opportunityId = existing?.id ?? null;

    if (existing) {
      const overrides =
        existing.ai_profile_overrides && typeof existing.ai_profile_overrides === "object"
          ? { ...existing.ai_profile_overrides }
          : {};
      overrides.mobile = row.mobile;
      const sourcePayload =
        existing.source_payload && typeof existing.source_payload === "object"
          ? { ...existing.source_payload }
          : {};
      const priorContexts =
        sourcePayload.voice_campaign_contexts && typeof sourcePayload.voice_campaign_contexts === "object"
          ? { ...(sourcePayload.voice_campaign_contexts as Record<string, unknown>) }
          : {};
      priorContexts[campaign.id] = buildCampaignContext(parsedWorkbook.campaignType, parsedWorkbook.sourceSheetName, row);
      sourcePayload.voice_campaign_contexts = priorContexts;

      const { error } = await admin
        .from("external_renewal_opportunities")
        .update({
          ai_profile_overrides: overrides,
          source_payload: sourcePayload,
          ai_profile_updated_at: new Date().toISOString(),
          ai_profile_updated_by: input.requestedByAuthUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) throw new Error("Could not prepare an existing renewal prospect.");
    } else {
      const { data: inserted, error } = await admin
        .from("external_renewal_opportunities")
        .insert({
          batch_id: batch.id,
          partner_id: partnerId,
          source_row_number: row.sourceRowNumber,
          mobile: row.mobile,
          customer_name: row.customerName,
          registration_no: row.registrationNumber,
          vehicle_make: row.manufacturer,
          vehicle_model: row.model,
          current_insurer: row.currentInsurer,
          current_policy_no: row.policyNumber,
          invoice_date: todayIso(),
          opportunity_status: "new",
          is_active: true,
          source_payload: {
            entry_type: "it_voice_campaign",
            campaign_id: campaign.id,
            source_sheet: parsedWorkbook.sourceSheetName,
            voice_campaign_contexts: {
              [campaign.id]: buildCampaignContext(parsedWorkbook.campaignType, parsedWorkbook.sourceSheetName, row),
            },
          },
          voice_queue_source: "it_campaign",
        })
        .select("id")
        .single<{ id: string }>();

      if (error || !inserted) throw new Error("Could not create a campaign prospect.");
      opportunityId = inserted.id;
    }

    const { error: memberError } = await admin.from("voice_campaign_members").insert({
      campaign_id: campaign.id,
      opportunity_id: opportunityId,
      source_row_number: row.sourceRowNumber,
      import_status: "accepted",
      enrichment_status: "pending",
      dispatch_status: "pending",
    });

    if (memberError) throw new Error("Could not add a campaign customer.");
    accepted += 1;
  }

  const status = accepted ? "enriching" : "needs_review";

  await Promise.all([
    admin
      .from("voice_campaigns")
      .update({
        status,
        accepted_rows: accepted,
        rejected_rows: rejected,
        duplicate_rows: duplicates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id),
    admin
      .from("external_renewal_import_batches")
      .update({
        accepted_rows: accepted,
        rejected_rows: rejected,
        duplicate_rows: duplicates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batch.id),
  ]);

  return { campaignId: campaign.id };
}

export async function enrichVoiceCampaignBatch(campaignId: string) {
  const admin = createSupabaseAdminClient();

  const { data: campaign } = await admin
    .from("voice_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle<{ status: string }>();

  if (!campaign || !["enriching", "needs_review", "ready"].includes(campaign.status)) {
    throw new Error("Campaign cannot be enriched now.");
  }

  const { data: members, error } = await admin
    .from("voice_campaign_members")
    .select("id,opportunity_id")
    .eq("campaign_id", campaignId)
    .eq("import_status", "accepted")
    .eq("enrichment_status", "pending")
    .order("source_row_number", { ascending: true })
    .limit(5)
    .returns<Array<{ id: string; opportunity_id: string }>>();

  if (error) throw new Error("Could not read the campaign enrichment queue.");

  for (const member of members ?? []) {
    try {
      const result = await enrichExternalRenewalOpportunity(member.opportunity_id);
      const ready = result.status === "ready";

      await admin
        .from("voice_campaign_members")
        .update({
          enrichment_status: ready ? "ready" : "failed",
          enrichment_error: ready ? null : "No usable RC details.",
          dispatch_status: ready ? "pending" : "held",
          dispatch_error: ready ? null : "RC enrichment is not ready.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id);
    } catch (errorValue) {
      await admin
        .from("voice_campaign_members")
        .update({
          enrichment_status: "failed",
          enrichment_error:
            errorValue instanceof Error ? errorValue.message.slice(0, 180) : "RC enrichment failed.",
          dispatch_status: "held",
          dispatch_error: "RC enrichment failed.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", member.id);
    }
  }

  const { data: states } = await admin
    .from("voice_campaign_members")
    .select("enrichment_status")
    .eq("campaign_id", campaignId)
    .returns<Array<{ enrichment_status: string }>>();

  const all = states ?? [];
  const pending = all.filter((row) => row.enrichment_status === "pending").length;
  const readyTotal = all.filter((row) => row.enrichment_status === "ready").length;
  const exceptions = all.filter((row) => ["failed", "held"].includes(row.enrichment_status)).length;
  const status = pending ? "enriching" : exceptions ? "needs_review" : "ready";

  await admin
    .from("voice_campaigns")
    .update({ status, enriched_rows: readyTotal, updated_at: new Date().toISOString() })
    .eq("id", campaignId);

  return { remaining: pending, readyTotal, status, done: pending === 0 };
}

export async function setVoiceCampaignStatus(campaignId: string, action: "start" | "pause" | "resume") {
  const admin = createSupabaseAdminClient();

  const { data: campaign } = await admin
    .from("voice_campaigns")
    .select("status")
    .eq("id", campaignId)
    .maybeSingle<{ status: string }>();

  if (!campaign) throw new Error("Campaign unavailable.");

  let status: string;

  if (action === "start") {
    if (!["ready", "needs_review"].includes(campaign.status)) throw new Error("Finish enrichment first.");
    status = "running";
  } else if (action === "pause") {
    if (campaign.status !== "running") throw new Error("Only running campaigns can pause.");
    status = "paused";
  } else {
    if (campaign.status !== "paused") throw new Error("Only paused campaigns can resume.");
    status = "running";
  }

  await admin
    .from("voice_campaigns")
    .update({
      status,
      ...(action === "start" ? { started_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  return { status };
}

export async function getVoiceCampaignDetail(campaignId: string) {
  const admin = createSupabaseAdminClient();

  const { data: campaign, error } = await admin
    .from("voice_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle<VoiceCampaignDetailRow>();

  if (error || !campaign) return null;

  const { data: members } = await admin
    .from("voice_campaign_members")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("source_row_number", { ascending: true })
    .limit(MAX_ROWS)
    .returns<VoiceCampaignMemberRow[]>();

  const opportunityIds = (members ?? []).map((row) => row.opportunity_id);
  const opportunityMap = new Map<string, VoiceCampaignOpportunityRow>();
  const attemptMap = new Map<string, VoiceCampaignAttemptRow>();

  if (opportunityIds.length) {
    const { data: opportunities } = await admin
      .from("external_renewal_opportunities")
      .select("id,registration_no,mobile,customer_name,contact_name,vehicle_make,vehicle_model,current_insurer,rc_enrichment_details,ai_profile_overrides")
      .in("id", opportunityIds)
      .returns<VoiceCampaignOpportunityRow[]>();

    for (const row of opportunities ?? []) opportunityMap.set(row.id, row);

    const { data: attempts } = await admin
      .from("external_renewal_voice_attempts")
      .select("opportunity_id,submission_status,call_disposition,created_at")
      .eq("voice_campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .returns<VoiceCampaignAttemptRow[]>();

    for (const row of attempts ?? []) {
      if (!attemptMap.has(row.opportunity_id)) attemptMap.set(row.opportunity_id, row);
    }
  }

  const views: VoiceCampaignMemberView[] = (members ?? []).map((row) => {
    const opportunity = opportunityMap.get(row.opportunity_id);
    const enrichment = opportunity?.rc_enrichment_details ?? {};
    const overrides = opportunity?.ai_profile_overrides ?? {};
    const text = (record: Record<string, unknown>, key: string) =>
      typeof record[key] === "string" && String(record[key]).trim() ? String(record[key]).trim() : null;

    const make = text(overrides, "manufacturer") ?? text(enrichment, "manufacturer") ?? opportunity?.vehicle_make ?? null;
    const model = text(overrides, "model") ?? text(enrichment, "model") ?? opportunity?.vehicle_model ?? null;
    const attempt = attemptMap.get(row.opportunity_id);

    return {
      ...row,
      opportunityId: row.opportunity_id,
      registrationNumber: opportunity?.registration_no ?? null,
      mobile: maskMobile(text(overrides, "mobile") ?? opportunity?.mobile ?? null),
      customerName: text(overrides, "customerName") ?? opportunity?.customer_name ?? opportunity?.contact_name ?? null,
      vehicle: [make, model].filter(Boolean).join(" ") || null,
      insurer:
        text(overrides, "insuranceCompany") ?? text(enrichment, "insuranceCompany") ?? opportunity?.current_insurer ?? null,
      policyExpiryDate: text(overrides, "policyExpiryDate") ?? text(enrichment, "policyExpiryDate") ?? null,
      attemptStatus: attempt?.submission_status ?? null,
      callDisposition: attempt?.call_disposition ?? null,
    };
  });

  return {
    campaign,
    members: views,
    counts: {
      ready: views.filter((row) => row.enrichment_status === "ready").length,
      held: views.filter((row) => row.import_status === "held" || row.enrichment_status === "failed").length,
      queued: views.filter((row) => row.dispatch_status === "queued").length,
      pendingDispatch: views.filter(
        (row) => row.enrichment_status === "ready" && row.dispatch_status === "pending",
      ).length,
    },
  };
}


function yesNo(value: boolean) {
  return value ? "Yes" : "No";
}

function reportText(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function deriveCustomerAvailability(attempt: VoiceCampaignReportAttemptRow | null) {
  if (!attempt) return "Not Called";
  if (attempt.connectivity_status === "connected") {
    const objection = (attempt.customer_objection ?? "").toLowerCase();
    if (/\bbusy\b|not free|call later|later/i.test(objection)) return "Busy";
    return "Available";
  }
  if (attempt.connectivity_status === "busy") return "Busy";
  if (attempt.connectivity_status === "no_answer") return "Unavailable";
  if (attempt.connectivity_status === "failed") return "Unavailable";
  return "Unknown";
}

function deriveFollowUpConfidence(attempt: VoiceCampaignReportAttemptRow | null) {
  if (!attempt?.follow_up_required) return "Not Required";
  if (attempt.follow_up_at) return "Exact";
  return "Broad / Unscheduled";
}

function deriveMainOutcome(attempt: VoiceCampaignReportAttemptRow | null) {
  if (!attempt) return "Not Called";
  if (attempt.connectivity_status === "busy") return "Busy - Follow-up Needed";
  if (attempt.connectivity_status === "no_answer") return "No Answer";
  if (attempt.connectivity_status === "failed" || attempt.submission_status === "failed") return "Call Failed";

  switch (attempt.call_disposition) {
    case "quote_requested":
      return "Interested - Quote Required";
    case "follow_up":
      return "Interested - Callback Required";
    case "interested":
      return "Interested - No Immediate Action";
    case "not_interested":
      return "Not Interested";
    case "already_renewed":
      return "Already Renewed";
    case "do_not_contact":
      return "Do Not Contact";
    case "wrong_person":
      return "Wrong Person";
    case "human_assistance":
      return "Human Assistance Required";
    case "no_decision":
      return "Connected - No Decision";
    default:
      return attempt.connectivity_status === "connected" ? "Connected - Outcome Pending" : "Pending";
  }
}

function deriveNextAction(attempt: VoiceCampaignReportAttemptRow | null) {
  if (!attempt) return "Await call";
  if (attempt.submission_status === "failed" || attempt.connectivity_status === "failed") return "Review call failure";
  if (attempt.connectivity_status === "busy" || attempt.connectivity_status === "no_answer") return "Retry / follow up";
  switch (attempt.call_disposition) {
    case "quote_requested":
      return "Prepare quotation";
    case "follow_up":
      return attempt.follow_up_at ? "Call back at agreed time" : "Schedule callback";
    case "interested":
      return "Renewal team follow-up";
    case "human_assistance":
      return "Human review";
    case "wrong_person":
      return "Verify contact";
    case "do_not_contact":
      return "No further contact";
    case "already_renewed":
    case "not_interested":
      return "Close / no action";
    default:
      return attempt.connectivity_status === "connected" ? "Review outcome" : "Await result";
  }
}

function deriveQualityFlag(attempt: VoiceCampaignReportAttemptRow | null) {
  if (!attempt) return "Not Called";
  if (attempt.submission_status === "failed" || attempt.connectivity_status === "failed") return "Call Failure";
  if (attempt.completion_status === "partial") return "Incomplete Call";
  if (attempt.follow_up_required && !attempt.follow_up_at) return "Follow-up Time Missing";
  if (["wrong_person", "human_assistance", "no_decision"].includes(attempt.call_disposition ?? "")) {
    return "Review Required";
  }
  if (attempt.connectivity_status === "busy" || attempt.connectivity_status === "no_answer") return "Not Connected";
  if (attempt.connectivity_status === "connected" && attempt.completion_status === "completed") return "Completed";
  return "Review Required";
}

export async function getVoiceCampaignReportRows(campaignId: string): Promise<{
  campaign: VoiceCampaignDetailRow;
  rows: VoiceCampaignReportRow[];
} | null> {
  const admin = createSupabaseAdminClient();

  const { data: campaign, error: campaignError } = await admin
    .from("voice_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle<VoiceCampaignDetailRow>();

  if (campaignError || !campaign) return null;

  const { data: members, error: membersError } = await admin
    .from("voice_campaign_members")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("source_row_number", { ascending: true })
    .limit(100)
    .returns<VoiceCampaignMemberRow[]>();

  if (membersError) throw new Error("Could not load campaign members for export.");

  const memberRows = members ?? [];
  const opportunityIds = memberRows.map((row) => row.opportunity_id);
  const opportunityMap = new Map<string, VoiceCampaignReportOpportunityRow>();
  const attemptsByOpportunity = new Map<string, VoiceCampaignReportAttemptRow[]>();
  const failureByAttempt = new Map<string, string>();

  if (opportunityIds.length) {
    const [{ data: opportunities, error: opportunitiesError }, { data: attempts, error: attemptsError }] =
      await Promise.all([
        admin
          .from("external_renewal_opportunities")
          .select(
            "id,registration_no,mobile,customer_name,contact_name,vehicle_make,vehicle_model,current_insurer,current_policy_no,policy_end_date,opportunity_status,rc_enrichment_details,ai_profile_overrides",
          )
          .in("id", opportunityIds)
          .returns<VoiceCampaignReportOpportunityRow[]>(),
        admin
          .from("external_renewal_voice_attempts")
          .select(
            "id,opportunity_id,submission_status,connectivity_status,completion_status,retry_attempt,duration_seconds,started_at,ended_at,call_disposition,customer_interest,follow_up_required,follow_up_at,customer_objection,call_summary,created_at,updated_at",
          )
          .eq("voice_campaign_id", campaignId)
          .order("created_at", { ascending: true })
          .returns<VoiceCampaignReportAttemptRow[]>(),
      ]);

    if (opportunitiesError || attemptsError) {
      throw new Error("Could not load campaign call data for export.");
    }

    for (const opportunity of opportunities ?? []) opportunityMap.set(opportunity.id, opportunity);

    for (const attempt of attempts ?? []) {
      const current = attemptsByOpportunity.get(attempt.opportunity_id) ?? [];
      current.push(attempt);
      attemptsByOpportunity.set(attempt.opportunity_id, current);
    }

    const attemptIds = (attempts ?? []).map((attempt) => attempt.id);
    if (attemptIds.length) {
      const { data: events, error: eventsError } = await admin
        .from("external_renewal_voice_attempt_events")
        .select("voice_attempt_id,failure_reason,created_at")
        .in("voice_attempt_id", attemptIds)
        .order("created_at", { ascending: false })
        .returns<VoiceCampaignReportAttemptEventRow[]>();

      if (eventsError) throw new Error("Could not load campaign call failures for export.");

      for (const event of events ?? []) {
        if (!failureByAttempt.has(event.voice_attempt_id) && event.failure_reason) {
          failureByAttempt.set(event.voice_attempt_id, event.failure_reason);
        }
      }
    }
  }

  const rows: VoiceCampaignReportRow[] = [];

  for (const member of memberRows) {
    const opportunity = opportunityMap.get(member.opportunity_id);
    const enrichment = opportunity?.rc_enrichment_details ?? {};
    const overrides = opportunity?.ai_profile_overrides ?? {};

    const customerName =
      reportText(overrides, "customerName") ??
      opportunity?.customer_name ??
      opportunity?.contact_name ??
      null;
    const mobileNumber = reportText(overrides, "mobile") ?? opportunity?.mobile ?? null;
    const registrationNumber =
      reportText(overrides, "registrationNumber") ??
      reportText(enrichment, "registrationNumber") ??
      opportunity?.registration_no ??
      null;
    const manufacturer =
      reportText(overrides, "manufacturer") ??
      reportText(enrichment, "manufacturer") ??
      opportunity?.vehicle_make ??
      null;
    const currentInsurer =
      reportText(overrides, "insuranceCompany") ??
      reportText(enrichment, "insuranceCompany") ??
      opportunity?.current_insurer ??
      null;
    const currentPolicyNumber =
      reportText(overrides, "policyNumber") ??
      reportText(enrichment, "policyNumber") ??
      opportunity?.current_policy_no ??
      null;
    const policyExpiryDate =
      reportText(overrides, "policyExpiryDate") ??
      reportText(enrichment, "policyExpiryDate") ??
      opportunity?.policy_end_date ??
      null;

    const attempts = attemptsByOpportunity.get(member.opportunity_id) ?? [];
    const reportAttempts: Array<VoiceCampaignReportAttemptRow | null> = attempts.length ? attempts : [null];

    reportAttempts.forEach((attempt, index) => {
      const disposition = attempt?.call_disposition ?? null;
      const memberFailure =
        member.dispatch_error ??
        member.enrichment_error ??
        member.hold_reason ??
        null;
      const failureReason = attempt ? failureByAttempt.get(attempt.id) ?? memberFailure : memberFailure;

      rows.push({
        campaignName: campaign.name,
        campaignStatus: campaign.status,
        customerName,
        mobileNumber,
        registrationNumber,
        manufacturer,
        currentInsurer,
        currentPolicyNumber,
        policyExpiryDate,
        callAttemptNumber: attempt ? index + 1 : null,
        customerAvailability: deriveCustomerAvailability(attempt),
        callDurationSeconds: attempt?.duration_seconds ?? null,
        connectivityStatus: attempt?.connectivity_status ?? null,
        completionStatus: attempt?.completion_status ?? null,
        submissionStatus: attempt?.submission_status ?? member.dispatch_status,
        callDisposition: disposition,
        customerInterest: attempt?.customer_interest ?? null,
        customerObjection: attempt?.customer_objection ?? null,
        followUpRequired: yesNo(Boolean(attempt?.follow_up_required)),
        followUpDateTime: attempt?.follow_up_at ?? null,
        followUpTimeConfidence: deriveFollowUpConfidence(attempt),
        quoteRequested: yesNo(disposition === "quote_requested"),
        humanAssistanceRequired: yesNo(disposition === "human_assistance"),
        doNotContact: yesNo(disposition === "do_not_contact" || opportunity?.opportunity_status === "do_not_contact"),
        wrongPerson: yesNo(disposition === "wrong_person"),
        alreadyRenewed: yesNo(disposition === "already_renewed" || opportunity?.opportunity_status === "renewed_elsewhere"),
        addOnInterest: "Not captured",
        mainConversationOutcome: deriveMainOutcome(attempt),
        callSummary: attempt?.call_summary ?? null,
        nextRecommendedAction: deriveNextAction(attempt),
        failureReason: failureReason ?? null,
        lastUpdatedAt: attempt?.updated_at ?? member.updated_at,
        conversationQualityFlag: deriveQualityFlag(attempt),
      });
    });
  }

  return { campaign, rows };
}
