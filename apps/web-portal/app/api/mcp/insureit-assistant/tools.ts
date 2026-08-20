import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const SIGNED_URL_TTL_SECONDS = 5 * 60;
const MAX_DOCUMENTS_PER_POLICY = 10;
const MAX_SEARCH_SCAN = 500;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

type PolicyRow = {
  id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  insurance_company_id: string | null;
  policy_no: string | null;
  policy_code: string | null;
  policy_type: string | null;
  start_date: string | null;
  end_date: string | null;
  insured_declared_value: number | null;
  intermediary_type: string | null;
  intermediary_code: string | null;
  lead_source: string | null;
  rm_name: string | null;
  business_line: string | null;
  business_type: string | null;
  issuance_date: string | null;
  policy_term: string | null;
  status: string | null;
  policy_service_source: string | null;
  created_at: string;
};

type PremiumRow = {
  policy_id: string;
  od_premium: number | null;
  tp_premium: number | null;
  cpa_opted: boolean | null;
  cpa_amount: number | null;
  net_premium: number | null;
  gst_amount: number | null;
  gross_premium: number | null;
};

type CustomerRow = {
  id: string;
  customer_code: string | null;
  company_name: string | null;
  contact_name: string | null;
  city: string | null;
  state: string | null;
  customer_type: string | null;
  partner_type: string | null;
  onboarding_status: string | null;
  status: string | null;
  fleet_size_band: string | null;
  created_at: string;
};

type VehicleRow = {
  id: string;
  customer_id: string | null;
  vehicle_no: string | null;
  vehicle_type: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  registration_date: string | null;
  vehicle_class_description: string | null;
  vehicle_category: string | null;
  body_type: string | null;
  is_commercial: boolean | null;
  fuel_type: string | null;
  registration_status: string | null;
  created_at: string;
};

type InsurerRow = {
  id: string;
  name: string | null;
};

type PolicyDocumentRow = {
  id: string;
  policy_id: string;
  document_type: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

type ClaimRow = {
  id: string;
  claim_no: string | null;
  insurer_claim_no: string | null;
  customer_id: string | null;
  vehicle_id: string | null;
  policy_id: string | null;
  insurance_company_id: string | null;
  current_status: string | null;
  accident_at: string | null;
  estimated_loss: number | null;
  approved_amount: number | null;
  settlement_amount: number | null;
  policy_service_source: string | null;
  claim_service_mode: string | null;
  assistance_status: string | null;
  assistance_requested_at: string | null;
  created_at: string;
  updated_at: string;
};

type ClaimDocumentRow = {
  id: string;
  claim_id: string;
  document_type: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  verification_status: string | null;
  milestone_key: string | null;
  created_at: string;
};

const policySelect = "id, customer_id, vehicle_id, insurance_company_id, policy_no, policy_code, policy_type, start_date, end_date, insured_declared_value, intermediary_type, intermediary_code, lead_source, rm_name, business_line, business_type, issuance_date, policy_term, status, policy_service_source, created_at";
const premiumSelect = "policy_id, od_premium, tp_premium, cpa_opted, cpa_amount, net_premium, gst_amount, gross_premium";
const customerSelect = "id, customer_code, company_name, contact_name, city, state, customer_type, partner_type, onboarding_status, status, fleet_size_band, created_at";
const vehicleSelect = "id, customer_id, vehicle_no, vehicle_type, make, model, year, registration_date, vehicle_class_description, vehicle_category, body_type, is_commercial, fuel_type, registration_status, created_at";
const insurerSelect = "id, name";
const claimSelect = "id, claim_no, insurer_claim_no, customer_id, vehicle_id, policy_id, insurance_company_id, current_status, accident_at, estimated_loss, approved_amount, settlement_amount, policy_service_source, claim_service_mode, assistance_status, assistance_requested_at, created_at, updated_at";

export function assistantToolDefinitions() {
  const readOnlyAnnotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };

  return [
    {
      name: "get_policy_document",
      title: "Get policy document",
      description: "Find an INSUREIT policy copy by exactly one policy/document reference and return short-lived signed download URLs.",
      inputSchema: {
        type: "object",
        properties: {
          documentId: { type: "string", description: "Exact policy_documents UUID." },
          policyId: { type: "string", description: "Exact policies UUID." },
          policyCode: { type: "string", description: "Exact INSUREIT policy code." },
          policyNo: { type: "string", description: "Exact insurer policy number." },
        },
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
    },
    {
      name: "search_policies",
      title: "Search policies",
      description: "Search INSUREIT policies by policy number/code, customer, vehicle, insurer, RM, status or issuance-date range. Returns operational summaries only.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search across policy number/code, customer, vehicle, insurer and RM." },
          status: { type: "string" },
          rmName: { type: "string" },
          issuanceFrom: { type: "string", description: "YYYY-MM-DD inclusive." },
          issuanceTo: { type: "string", description: "YYYY-MM-DD inclusive." },
          limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
        },
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
    },
    {
      name: "get_policy_details",
      title: "Get policy details",
      description: "Get one exact policy with premium, customer, vehicle and insurer summaries. Does not return customer identity documents or private storage paths.",
      inputSchema: {
        type: "object",
        properties: {
          policyId: { type: "string" },
          policyCode: { type: "string" },
          policyNo: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
    },
    {
      name: "get_customer",
      title: "Get customer",
      description: "Find a customer by exact ID/code or by company/contact name. Returns a non-sensitive customer summary.",
      inputSchema: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          customerCode: { type: "string" },
          name: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
    },
    {
      name: "get_vehicle",
      title: "Get vehicle",
      description: "Find a vehicle by exact ID or registration number and return a safe operational summary without chassis or engine numbers.",
      inputSchema: {
        type: "object",
        properties: {
          vehicleId: { type: "string" },
          vehicleNo: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
    },
    {
      name: "get_customer_fleet",
      title: "Get customer fleet",
      description: "Return a customer's vehicle fleet and linked policy summaries using an exact customer ID/code or an unambiguous customer name.",
      inputSchema: {
        type: "object",
        properties: {
          customerId: { type: "string" },
          customerCode: { type: "string" },
          name: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
    },
    {
      name: "get_monthly_business",
      title: "Get monthly business",
      description: "Calculate policy count and premium totals for an issuance month using policy_premium_details, with RM and insurer breakdowns.",
      inputSchema: {
        type: "object",
        properties: {
          year: { type: "integer", minimum: 2000, maximum: 2100 },
          month: { type: "integer", minimum: 1, maximum: 12 },
          rmName: { type: "string" },
          insurerName: { type: "string" },
        },
        required: ["year", "month"],
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
    },
    {
      name: "search_claims",
      title: "Search claims",
      description: "Search claim records by claim number, insurer claim number, customer, vehicle, policy, insurer or status. Returns bounded operational summaries.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          status: { type: "string" },
          createdFrom: { type: "string", description: "YYYY-MM-DD inclusive." },
          createdTo: { type: "string", description: "YYYY-MM-DD inclusive." },
          limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
        },
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
    },
    {
      name: "get_claim_details",
      title: "Get claim details",
      description: "Get one exact claim plus related policy/customer/vehicle/insurer summaries and claim-document metadata. No document download URLs are returned.",
      inputSchema: {
        type: "object",
        properties: {
          claimId: { type: "string" },
          claimNo: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
    },
  ];
}

export async function callAssistantTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case "get_policy_document":
        return getPolicyDocument(args);
      case "search_policies":
        return searchPolicies(args);
      case "get_policy_details":
        return getPolicyDetails(args);
      case "get_customer":
        return getCustomer(args);
      case "get_vehicle":
        return getVehicle(args);
      case "get_customer_fleet":
        return getCustomerFleet(args);
      case "get_monthly_business":
        return getMonthlyBusiness(args);
      case "search_claims":
        return searchClaims(args);
      case "get_claim_details":
        return getClaimDetails(args);
      default:
        return { ok: false, error: "Unknown tool." };
    }
  } catch {
    return { ok: false, error: "The INSUREIT assistant data lookup failed unexpectedly." };
  }
}

async function getPolicyDocument(args: Record<string, unknown>): Promise<ToolResult> {
  const reference = {
    documentId: cleanString(args.documentId, 80),
    policyId: cleanString(args.policyId, 80),
    policyCode: cleanString(args.policyCode, 120),
    policyNo: cleanString(args.policyNo, 160),
  };
  if (Object.values(reference).filter(Boolean).length !== 1) {
    return { ok: false, error: "Provide exactly one of documentId, policyId, policyCode, or policyNo." };
  }

  const admin = createSupabaseAdminClient();
  if (reference.documentId) {
    const { data, error } = await admin
      .from("policy_documents")
      .select("id, policy_id, document_type, file_name, storage_bucket, storage_path, mime_type, file_size, created_at")
      .eq("id", reference.documentId)
      .eq("document_type", "policy_copy")
      .maybeSingle<PolicyDocumentRow>();
    if (error) return { ok: false, error: "Could not look up the policy document." };
    if (!data) return { ok: false, error: "Policy document not found." };
    const signed = await signPolicyDocument(admin, data);
    if (!signed) return { ok: false, error: "Could not create a signed policy-document URL." };
    return { ok: true, data: { expiresInSeconds: SIGNED_URL_TTL_SECONDS, documents: [signed] } };
  }

  const policyResult = await findExactPolicy(admin, reference);
  if (!policyResult.ok) return policyResult;
  const policy = policyResult.data as PolicyRow;
  const { data: rows, error } = await admin
    .from("policy_documents")
    .select("id, policy_id, document_type, file_name, storage_bucket, storage_path, mime_type, file_size, created_at")
    .eq("policy_id", policy.id)
    .eq("document_type", "policy_copy")
    .order("created_at", { ascending: false })
    .limit(MAX_DOCUMENTS_PER_POLICY)
    .returns<PolicyDocumentRow[]>();
  if (error) return { ok: false, error: "Could not look up policy documents." };
  if (!rows?.length) return { ok: false, error: "No policy copy is attached to this policy." };
  const signed = await Promise.all(rows.map((row) => signPolicyDocument(admin, row)));
  if (signed.some((item) => !item)) return { ok: false, error: "Could not create a signed policy-document URL." };
  return {
    ok: true,
    data: {
      policy: policyIdentity(policy),
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      documents: signed.filter(Boolean),
    },
  };
}

async function searchPolicies(args: Record<string, unknown>): Promise<ToolResult> {
  const admin = createSupabaseAdminClient();
  const limit = cleanLimit(args.limit);
  const status = cleanString(args.status, 80);
  const rmName = cleanString(args.rmName, 160);
  const issuanceFrom = cleanDate(args.issuanceFrom);
  const issuanceTo = cleanDate(args.issuanceTo);
  const queryText = cleanString(args.query, 180)?.toLowerCase() ?? null;

  let query = admin.from("policies").select(policySelect).order("issuance_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(MAX_SEARCH_SCAN);
  if (status) query = query.eq("status", status);
  if (rmName) query = query.ilike("rm_name", `%${escapeLike(rmName)}%`);
  if (issuanceFrom) query = query.gte("issuance_date", issuanceFrom);
  if (issuanceTo) query = query.lte("issuance_date", issuanceTo);

  const { data, error } = await query.returns<PolicyRow[]>();
  if (error) return { ok: false, error: "Could not search policies." };
  const policies = data ?? [];
  const enriched = await enrichPolicies(admin, policies);
  const filtered = queryText
    ? enriched.filter((item) => searchable([
        item.policyNo,
        item.policyCode,
        item.rmName,
        item.customer?.customerCode,
        item.customer?.companyName,
        item.customer?.contactName,
        item.vehicle?.vehicleNo,
        item.vehicle?.make,
        item.vehicle?.model,
        item.insurer?.name,
      ], queryText))
    : enriched;

  return { ok: true, data: { count: Math.min(filtered.length, limit), results: filtered.slice(0, limit) } };
}

async function getPolicyDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const reference = {
    policyId: cleanString(args.policyId, 80),
    policyCode: cleanString(args.policyCode, 120),
    policyNo: cleanString(args.policyNo, 160),
  };
  if (Object.values(reference).filter(Boolean).length !== 1) {
    return { ok: false, error: "Provide exactly one of policyId, policyCode, or policyNo." };
  }
  const admin = createSupabaseAdminClient();
  const policyResult = await findExactPolicy(admin, reference);
  if (!policyResult.ok) return policyResult;
  const enriched = await enrichPolicies(admin, [policyResult.data as PolicyRow]);
  const policy = enriched[0];
  if (!policy) return { ok: false, error: "Policy not found." };
  const { count } = await admin
    .from("policy_documents")
    .select("id", { count: "exact", head: true })
    .eq("policy_id", policy.id)
    .eq("document_type", "policy_copy");
  return { ok: true, data: { ...policy, policyCopyCount: count ?? 0 } };
}

async function getCustomer(args: Record<string, unknown>): Promise<ToolResult> {
  const admin = createSupabaseAdminClient();
  const result = await findCustomer(admin, args);
  if (!result.ok) return result;
  return { ok: true, data: result.data };
}

async function getVehicle(args: Record<string, unknown>): Promise<ToolResult> {
  const vehicleId = cleanString(args.vehicleId, 80);
  const vehicleNo = cleanString(args.vehicleNo, 80);
  if ([vehicleId, vehicleNo].filter(Boolean).length !== 1) {
    return { ok: false, error: "Provide exactly one of vehicleId or vehicleNo." };
  }
  const admin = createSupabaseAdminClient();
  let query = admin.from("vehicles").select(vehicleSelect);
  if (vehicleId) query = query.eq("id", vehicleId);
  if (vehicleNo) {
    const normalized = normalizeVehicleNo(vehicleNo);
    query = query.or(`vehicle_no.eq.${escapeFilterValue(vehicleNo)},vehicle_no_normalized.eq.${escapeFilterValue(normalized)}`);
  }
  const { data, error } = await query.limit(2).returns<VehicleRow[]>();
  if (error) return { ok: false, error: "Could not look up the vehicle." };
  if (!data?.length) return { ok: false, error: "Vehicle not found." };
  if (data.length > 1) return { ok: false, error: "Vehicle reference is ambiguous." };
  const vehicle = vehicleSummary(data[0]);
  let customer: ReturnType<typeof customerSummary> | null = null;
  if (data[0].customer_id) {
    const { data: customerRow } = await admin.from("customers").select(customerSelect).eq("id", data[0].customer_id).maybeSingle<CustomerRow>();
    customer = customerRow ? customerSummary(customerRow) : null;
  }
  return { ok: true, data: { ...vehicle, customer } };
}

async function getCustomerFleet(args: Record<string, unknown>): Promise<ToolResult> {
  const admin = createSupabaseAdminClient();
  const customerResult = await findCustomer(admin, args, true);
  if (!customerResult.ok) return customerResult;
  const customer = customerResult.data as ReturnType<typeof customerSummary>;

  const [{ data: vehicleRows, error: vehicleError }, { data: policyRows, error: policyError }] = await Promise.all([
    admin.from("vehicles").select(vehicleSelect).eq("customer_id", customer.id).order("vehicle_no").limit(200).returns<VehicleRow[]>(),
    admin.from("policies").select(policySelect).eq("customer_id", customer.id).order("end_date", { ascending: false, nullsFirst: false }).limit(200).returns<PolicyRow[]>(),
  ]);
  if (vehicleError || policyError) return { ok: false, error: "Could not load the customer fleet." };
  const policies = await enrichPolicies(admin, policyRows ?? []);
  return {
    ok: true,
    data: {
      customer,
      vehicleCount: vehicleRows?.length ?? 0,
      policyCount: policies.length,
      vehicles: (vehicleRows ?? []).map(vehicleSummary),
      policies,
    },
  };
}

async function getMonthlyBusiness(args: Record<string, unknown>): Promise<ToolResult> {
  const year = cleanInteger(args.year);
  const month = cleanInteger(args.month);
  if (!year || year < 2000 || year > 2100 || !month || month < 1 || month > 12) {
    return { ok: false, error: "Provide a valid year and month." };
  }
  const rmName = cleanString(args.rmName, 160)?.toLowerCase() ?? null;
  const insurerName = cleanString(args.insurerName, 160)?.toLowerCase() ?? null;
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("policies")
    .select(policySelect)
    .gte("issuance_date", from)
    .lt("issuance_date", nextMonth)
    .order("issuance_date", { ascending: true })
    .limit(5000)
    .returns<PolicyRow[]>();
  if (error) return { ok: false, error: "Could not load monthly policy business." };
  let policies = await enrichPolicies(admin, data ?? []);
  if (rmName) policies = policies.filter((item) => item.rmName?.toLowerCase().includes(rmName));
  if (insurerName) policies = policies.filter((item) => item.insurer?.name?.toLowerCase().includes(insurerName));

  const totals = policies.reduce((acc, item) => {
    acc.netPremium += numberValue(item.premium?.netPremium);
    acc.gstAmount += numberValue(item.premium?.gstAmount);
    acc.grossPremium += numberValue(item.premium?.grossPremium);
    acc.odPremium += numberValue(item.premium?.odPremium);
    acc.tpPremium += numberValue(item.premium?.tpPremium);
    return acc;
  }, { netPremium: 0, gstAmount: 0, grossPremium: 0, odPremium: 0, tpPremium: 0 });

  return {
    ok: true,
    data: {
      period: { year, month, from, toExclusive: nextMonth },
      filters: { rmName: cleanString(args.rmName, 160), insurerName: cleanString(args.insurerName, 160) },
      policyCount: policies.length,
      totals: roundTotals(totals),
      byRm: aggregateBusiness(policies, (item) => item.rmName ?? "Unassigned"),
      byInsurer: aggregateBusiness(policies, (item) => item.insurer?.name ?? "Unknown insurer"),
    },
  };
}

async function searchClaims(args: Record<string, unknown>): Promise<ToolResult> {
  const admin = createSupabaseAdminClient();
  const limit = cleanLimit(args.limit);
  const queryText = cleanString(args.query, 180)?.toLowerCase() ?? null;
  const status = cleanString(args.status, 80);
  const createdFrom = cleanDate(args.createdFrom);
  const createdTo = cleanDate(args.createdTo);
  let query = admin.from("claims").select(claimSelect).order("created_at", { ascending: false }).limit(MAX_SEARCH_SCAN);
  if (status) query = query.eq("current_status", status);
  if (createdFrom) query = query.gte("created_at", `${createdFrom}T00:00:00Z`);
  if (createdTo) query = query.lte("created_at", `${createdTo}T23:59:59.999Z`);
  const { data, error } = await query.returns<ClaimRow[]>();
  if (error) return { ok: false, error: "Could not search claims." };
  const enriched = await enrichClaims(admin, data ?? []);
  const filtered = queryText
    ? enriched.filter((item) => searchable([
        item.claimNo,
        item.insurerClaimNo,
        item.customer?.customerCode,
        item.customer?.companyName,
        item.customer?.contactName,
        item.vehicle?.vehicleNo,
        item.policy?.policyNo,
        item.policy?.policyCode,
        item.insurer?.name,
      ], queryText))
    : enriched;
  return { ok: true, data: { count: Math.min(filtered.length, limit), results: filtered.slice(0, limit) } };
}

async function getClaimDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const claimId = cleanString(args.claimId, 80);
  const claimNo = cleanString(args.claimNo, 120);
  if ([claimId, claimNo].filter(Boolean).length !== 1) {
    return { ok: false, error: "Provide exactly one of claimId or claimNo." };
  }
  const admin = createSupabaseAdminClient();
  let query = admin.from("claims").select(claimSelect);
  if (claimId) query = query.eq("id", claimId);
  if (claimNo) query = query.eq("claim_no", claimNo);
  const { data, error } = await query.limit(2).returns<ClaimRow[]>();
  if (error) return { ok: false, error: "Could not look up the claim." };
  if (!data?.length) return { ok: false, error: "Claim not found." };
  if (data.length > 1) return { ok: false, error: "Claim reference is ambiguous." };
  const [claim] = await enrichClaims(admin, [data[0]]);
  const { data: docs, error: docsError } = await admin
    .from("claim_documents")
    .select("id, claim_id, document_type, file_name, mime_type, file_size, verification_status, milestone_key, created_at")
    .eq("claim_id", data[0].id)
    .order("created_at", { ascending: false })
    .limit(100)
    .returns<ClaimDocumentRow[]>();
  if (docsError) return { ok: false, error: "Could not load claim document metadata." };
  return {
    ok: true,
    data: {
      ...claim,
      documents: (docs ?? []).map((doc) => ({
        id: doc.id,
        documentType: doc.document_type,
        fileName: doc.file_name,
        mimeType: doc.mime_type,
        fileSize: doc.file_size,
        verificationStatus: doc.verification_status,
        milestoneKey: doc.milestone_key,
        createdAt: doc.created_at,
      })),
    },
  };
}

async function findExactPolicy(admin: AdminClient, reference: { policyId?: string | null; policyCode?: string | null; policyNo?: string | null }) {
  let query = admin.from("policies").select(policySelect);
  if (reference.policyId) query = query.eq("id", reference.policyId);
  if (reference.policyCode) query = query.eq("policy_code", reference.policyCode);
  if (reference.policyNo) query = query.eq("policy_no", reference.policyNo);
  const { data, error } = await query.limit(2).returns<PolicyRow[]>();
  if (error) return { ok: false as const, error: "Could not look up the policy." };
  if (!data?.length) return { ok: false as const, error: "Policy not found." };
  if (data.length > 1) return { ok: false as const, error: "Policy reference is ambiguous." };
  return { ok: true as const, data: data[0] };
}

async function findCustomer(admin: AdminClient, args: Record<string, unknown>, requireUnique = false): Promise<ToolResult> {
  const customerId = cleanString(args.customerId, 80);
  const customerCode = cleanString(args.customerCode, 120);
  const name = cleanString(args.name, 180);
  if ([customerId, customerCode, name].filter(Boolean).length !== 1) {
    return { ok: false, error: "Provide exactly one of customerId, customerCode, or name." };
  }
  let query = admin.from("customers").select(customerSelect);
  if (customerId) query = query.eq("id", customerId);
  if (customerCode) query = query.eq("customer_code", customerCode);
  if (name) {
    const safe = escapeFilterValue(`%${name}%`);
    query = query.or(`company_name.ilike.${safe},contact_name.ilike.${safe}`);
  }
  const { data, error } = await query.limit(name ? 10 : 2).returns<CustomerRow[]>();
  if (error) return { ok: false, error: "Could not look up the customer." };
  if (!data?.length) return { ok: false, error: "Customer not found." };
  if ((requireUnique || !name) && data.length > 1) return { ok: false, error: "Customer reference is ambiguous. Use customerId or customerCode." };
  const summaries = data.map(customerSummary);
  return { ok: true, data: requireUnique || !name ? summaries[0] : { count: summaries.length, results: summaries } };
}

async function enrichPolicies(admin: AdminClient, policies: PolicyRow[]) {
  if (!policies.length) return [];
  const premiumIds = unique(policies.map((row) => row.id));
  const customerIds = unique(policies.map((row) => row.customer_id));
  const vehicleIds = unique(policies.map((row) => row.vehicle_id));
  const insurerIds = unique(policies.map((row) => row.insurance_company_id));
  const [premiumsResult, customersResult, vehiclesResult, insurersResult] = await Promise.all([
    premiumIds.length ? admin.from("policy_premium_details").select(premiumSelect).in("policy_id", premiumIds).returns<PremiumRow[]>() : Promise.resolve({ data: [] as PremiumRow[], error: null }),
    customerIds.length ? admin.from("customers").select(customerSelect).in("id", customerIds).returns<CustomerRow[]>() : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    vehicleIds.length ? admin.from("vehicles").select(vehicleSelect).in("id", vehicleIds).returns<VehicleRow[]>() : Promise.resolve({ data: [] as VehicleRow[], error: null }),
    insurerIds.length ? admin.from("insurance_companies").select(insurerSelect).in("id", insurerIds).returns<InsurerRow[]>() : Promise.resolve({ data: [] as InsurerRow[], error: null }),
  ]);
  if (premiumsResult.error || customersResult.error || vehiclesResult.error || insurersResult.error) throw new Error("enrichment_failed");
  const premiumMap = new Map((premiumsResult.data ?? []).map((row) => [row.policy_id, row]));
  const customerMap = new Map((customersResult.data ?? []).map((row) => [row.id, row]));
  const vehicleMap = new Map((vehiclesResult.data ?? []).map((row) => [row.id, row]));
  const insurerMap = new Map((insurersResult.data ?? []).map((row) => [row.id, row]));
  return policies.map((policy) => ({
    ...policySummary(policy),
    premium: premiumSummary(premiumMap.get(policy.id) ?? null),
    customer: policy.customer_id && customerMap.has(policy.customer_id) ? customerSummary(customerMap.get(policy.customer_id)!) : null,
    vehicle: policy.vehicle_id && vehicleMap.has(policy.vehicle_id) ? vehicleSummary(vehicleMap.get(policy.vehicle_id)!) : null,
    insurer: policy.insurance_company_id && insurerMap.has(policy.insurance_company_id) ? insurerSummary(insurerMap.get(policy.insurance_company_id)!) : null,
  }));
}

async function enrichClaims(admin: AdminClient, claims: ClaimRow[]) {
  if (!claims.length) return [];
  const customerIds = unique(claims.map((row) => row.customer_id));
  const vehicleIds = unique(claims.map((row) => row.vehicle_id));
  const policyIds = unique(claims.map((row) => row.policy_id));
  const insurerIds = unique(claims.map((row) => row.insurance_company_id));
  const [customersResult, vehiclesResult, policiesResult, insurersResult] = await Promise.all([
    customerIds.length ? admin.from("customers").select(customerSelect).in("id", customerIds).returns<CustomerRow[]>() : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    vehicleIds.length ? admin.from("vehicles").select(vehicleSelect).in("id", vehicleIds).returns<VehicleRow[]>() : Promise.resolve({ data: [] as VehicleRow[], error: null }),
    policyIds.length ? admin.from("policies").select(policySelect).in("id", policyIds).returns<PolicyRow[]>() : Promise.resolve({ data: [] as PolicyRow[], error: null }),
    insurerIds.length ? admin.from("insurance_companies").select(insurerSelect).in("id", insurerIds).returns<InsurerRow[]>() : Promise.resolve({ data: [] as InsurerRow[], error: null }),
  ]);
  if (customersResult.error || vehiclesResult.error || policiesResult.error || insurersResult.error) throw new Error("claim_enrichment_failed");
  const customerMap = new Map((customersResult.data ?? []).map((row) => [row.id, row]));
  const vehicleMap = new Map((vehiclesResult.data ?? []).map((row) => [row.id, row]));
  const policyMap = new Map((policiesResult.data ?? []).map((row) => [row.id, row]));
  const insurerMap = new Map((insurersResult.data ?? []).map((row) => [row.id, row]));
  return claims.map((claim) => ({
    id: claim.id,
    claimNo: claim.claim_no,
    insurerClaimNo: claim.insurer_claim_no,
    currentStatus: claim.current_status,
    accidentAt: claim.accident_at,
    estimatedLoss: claim.estimated_loss,
    approvedAmount: claim.approved_amount,
    settlementAmount: claim.settlement_amount,
    policyServiceSource: claim.policy_service_source,
    claimServiceMode: claim.claim_service_mode,
    assistanceStatus: claim.assistance_status,
    assistanceRequestedAt: claim.assistance_requested_at,
    createdAt: claim.created_at,
    updatedAt: claim.updated_at,
    customer: claim.customer_id && customerMap.has(claim.customer_id) ? customerSummary(customerMap.get(claim.customer_id)!) : null,
    vehicle: claim.vehicle_id && vehicleMap.has(claim.vehicle_id) ? vehicleSummary(vehicleMap.get(claim.vehicle_id)!) : null,
    policy: claim.policy_id && policyMap.has(claim.policy_id) ? policyIdentity(policyMap.get(claim.policy_id)!) : null,
    insurer: claim.insurance_company_id && insurerMap.has(claim.insurance_company_id) ? insurerSummary(insurerMap.get(claim.insurance_company_id)!) : null,
  }));
}

async function signPolicyDocument(admin: AdminClient, row: PolicyDocumentRow) {
  const { data, error } = await admin.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return {
    id: row.id,
    policyId: row.policy_id,
    documentType: row.document_type,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    createdAt: row.created_at,
    url: data.signedUrl,
  };
}

function policySummary(row: PolicyRow) {
  return {
    id: row.id,
    policyCode: row.policy_code,
    policyNo: row.policy_no,
    policyType: row.policy_type,
    startDate: row.start_date,
    endDate: row.end_date,
    issuanceDate: row.issuance_date,
    insuredDeclaredValue: row.insured_declared_value,
    status: row.status,
    rmName: row.rm_name,
    leadSource: row.lead_source,
    intermediaryType: row.intermediary_type,
    intermediaryCode: row.intermediary_code,
    businessLine: row.business_line,
    businessType: row.business_type,
    policyTerm: row.policy_term,
    policyServiceSource: row.policy_service_source,
    createdAt: row.created_at,
  };
}

function policyIdentity(row: PolicyRow) {
  return { id: row.id, policyCode: row.policy_code, policyNo: row.policy_no, status: row.status, endDate: row.end_date };
}

function premiumSummary(row: PremiumRow | null) {
  if (!row) return null;
  return {
    odPremium: row.od_premium,
    tpPremium: row.tp_premium,
    cpaOpted: row.cpa_opted,
    cpaAmount: row.cpa_amount,
    netPremium: row.net_premium,
    gstAmount: row.gst_amount,
    grossPremium: row.gross_premium,
  };
}

function customerSummary(row: CustomerRow) {
  return {
    id: row.id,
    customerCode: row.customer_code,
    companyName: row.company_name,
    contactName: row.contact_name,
    city: row.city,
    state: row.state,
    customerType: row.customer_type,
    partnerType: row.partner_type,
    onboardingStatus: row.onboarding_status,
    status: row.status,
    fleetSizeBand: row.fleet_size_band,
    createdAt: row.created_at,
  };
}

function vehicleSummary(row: VehicleRow) {
  return {
    id: row.id,
    customerId: row.customer_id,
    vehicleNo: row.vehicle_no,
    vehicleType: row.vehicle_type,
    make: row.make,
    model: row.model,
    year: row.year,
    registrationDate: row.registration_date,
    vehicleClassDescription: row.vehicle_class_description,
    vehicleCategory: row.vehicle_category,
    bodyType: row.body_type,
    isCommercial: row.is_commercial,
    fuelType: row.fuel_type,
    registrationStatus: row.registration_status,
    createdAt: row.created_at,
  };
}

function insurerSummary(row: InsurerRow) {
  return { id: row.id, name: row.name };
}

function aggregateBusiness(
  policies: Awaited<ReturnType<typeof enrichPolicies>>,
  keyFn: (item: Awaited<ReturnType<typeof enrichPolicies>>[number]) => string,
) {
  const groups = new Map<string, { policyCount: number; netPremium: number; gstAmount: number; grossPremium: number }>();
  for (const item of policies) {
    const key = keyFn(item);
    const current = groups.get(key) ?? { policyCount: 0, netPremium: 0, gstAmount: 0, grossPremium: 0 };
    current.policyCount += 1;
    current.netPremium += numberValue(item.premium?.netPremium);
    current.gstAmount += numberValue(item.premium?.gstAmount);
    current.grossPremium += numberValue(item.premium?.grossPremium);
    groups.set(key, current);
  }
  return [...groups.entries()]
    .map(([name, values]) => ({ name, ...roundTotals(values) }))
    .sort((a, b) => b.grossPremium - a.grossPremium);
}

function roundTotals<T extends Record<string, number>>(values: T): T {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, Math.round((value + Number.EPSILON) * 100) / 100])) as T;
}

function searchable(values: Array<string | number | null | undefined>, query: string) {
  return values.some((value) => value !== null && value !== undefined && String(value).toLowerCase().includes(query));
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function cleanInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
}

function cleanDate(value: unknown) {
  const text = cleanString(value, 10);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanLimit(value: unknown) {
  const parsed = cleanInteger(value);
  return parsed ? Math.max(1, Math.min(MAX_LIMIT, parsed)) : DEFAULT_LIMIT;
}

function normalizeVehicleNo(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function unique(values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function numberValue(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function escapeLike(value: string) {
  return value.replace(/[%,()]/g, " ").trim();
}

function escapeFilterValue(value: string) {
  return value.replace(/[(),]/g, " ").trim();
}
