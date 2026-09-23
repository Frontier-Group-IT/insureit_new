import type { OperationsDashboardData } from "@/lib/operations-dashboard";
import {
  getAccessibleCustomerIds,
  getAccessibleIntermediaryApplicationIds,
  getAccessibleIntermediaryIds,
} from "@/lib/employee-access-scope";
import { buildIntermediaryDocumentSlots } from "@/lib/intermediary-document-slots";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ProfileLike = { id: string; role?: string | null };

export type DashboardAccess = {
  viewPolicies: boolean;
  viewVehicles: boolean;
  viewClaims: boolean;
  viewIntermediaries: boolean;
  viewPolicyIntakes: boolean;
  reviewPolicyIntakes: boolean;
  viewCustomers: boolean;
  viewTasks: boolean;
  viewKyc: boolean;
  viewAccounts: boolean;
  commercial: boolean;
};

type PolicyRow = {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  insurance_company_id: string | null;
  policy_type: string | null;
  business_line: string | null;
  business_type: string | null;
  policy_product: string | null;
  status: string | null;
  issuance_date: string | null;
  created_at: string;
  end_date: string;
  intermediary_type: string | null;
  intermediary_code: string | null;
  lead_source: string | null;
  intermediary_group_id: string | null;
  intermediary_group_name: string | null;
};

type PremiumRow = {
  policy_id: string;
  net_premium: number | string | null;
  gross_premium: number | string | null;
};

type VehicleRow = {
  id: string;
  customer_id: string;
  vehicle_no: string | null;
  vehicle_type: string | null;
  registration_status: string | null;
  authbridge_verified: boolean | null;
};

export type DashboardClaimRow = {
  id: string;
  claim_no: string;
  current_status: string;
  updated_at: string;
  customerName: string;
  vehicleNo: string | null;
};

type ClaimRow = {
  id: string;
  vehicle_id: string | null;
  claim_no: string;
  current_status: string;
  created_at: string;
  updated_at: string;
  assistance_status: string | null;
  claim_service_mode: string | null;
  policy_service_source: string | null;
  estimated_loss: number | string | null;
  approved_amount: number | string | null;
  settlement_amount: number | string | null;
  customers: { company_name: string | null; contact_name: string | null } | null;
  vehicles: { vehicle_no: string | null } | null;
};

type ClaimFinancialRow = {
  claim_id: string;
  estimate_amount: number | string | null;
  approved_amount: number | string | null;
  bill_amount: number | string | null;
  do_amount: number | string | null;
  payment_received_amount: number | string | null;
};

type ClaimStageDetailRow = {
  claim_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
};

export type DashboardIntakeRow = {
  id: string;
  intake_number: string;
  status: string;
  ocr_status: string;
  lead_source_name: string;
  customer_mobile: string;
  attention_reason: string | null;
  created_at: string;
  updated_at: string;
};

type IntermediaryRow = {
  id: string;
  intermediary_code: string | null;
  intermediary_type: string | null;
  display_name: string | null;
  account_status: string | null;
};

type OnboardingRow = {
  id: string;
  status: string;
  registration_status: string | null;
  partner_status: string | null;
  final_type: string | null;
  draft_data: Record<string, unknown> | null;
};
type OnboardingProfileRow = { application_id: string; workflow_stage: string | null; gst_number: string | null };
type OnboardingDocumentRow = { application_id: string; document_type: string; file_name: string; document_label: string | null };
type InsurerRow = { id: string; name: string };

type PayinRow = {
  policy_id: string;
  total_projected_payin: number | string | null;
  payin_after_tds: number | string | null;
  commercial_status: string | null;
};

type PayoutRow = {
  policy_id: string;
  gross_payout: number | string | null;
  partner_payout_amount: number | string | null;
  retention_amount: number | string | null;
  commercial_status: string | null;
  status: string | null;
};

type ReceivableRow = { debit_amount: number | string | null; credit_amount: number | string | null };
type InvoiceRow = { id: string; outstanding_amount: number | string | null; due_date: string | null };
type PayableRow = { id: string; outstanding_amount: number | string | null; status: string | null };

export type AmountMixRow = {
  key: string;
  label: string;
  policies: number;
  amount: number | null;
};

export type RankedBusinessRow = {
  key: string;
  label: string;
  detail: string | null;
  policies: number;
  amount: number;
};

export type DashboardCurrentData = {
  generatedAt: Date;
  monthLabel: string;
  base: OperationsDashboardData;
  portfolio: {
    total: number;
    active: number;
    motor: number;
    life: number;
    nonMotor: number;
    health: number;
    other: number;
  } | null;
  mtd: {
    policies: number;
    grossPremium: number | null;
    netPremium: number | null;
    averageGrossPremium: number | null;
    activeProducers: number;
    channelMix: AmountMixRow[];
    vehicleClassMix: AmountMixRow[];
    coverageMix: AmountMixRow[];
    businessLineMix: AmountMixRow[];
    topInsurers: RankedBusinessRow[];
    topProducers: RankedBusinessRow[];
    topGroups: RankedBusinessRow[];
  } | null;
  renewals: {
    expired: number;
    due0to7: number;
    due8to15: number;
    due16to30: number;
    due31to45: number;
  } | null;
  fleet: {
    total: number;
    registered: number;
    registrationPending: number;
    incompleteLegacy: number;
    authbridgeVerified: number;
  } | null;
  claims: {
    open: number;
    settled: number;
    openAmount: number;
    settledAmount: number;
    mtd: number;
    assistanceRequested: number;
    pendingDocuments: number;
    actionPendingVehicles: number;
    estimateExposure: number;
    approvedExposure: number;
    billExposure: number;
    doExposure: number;
    paymentReceived: number;
    aging: Array<{ label: string; value: number; tone: string }>;
    recent: DashboardClaimRow[];
  } | null;
  tasks: {
    open: number;
    overdue: number;
  } | null;
  policyIntakes: {
    active: number;
    actionRequired: number;
    inReview: number;
    processing: number;
    workload: number;
    needsAttention: number;
    ocrFailed: number;
    recent: DashboardIntakeRow[];
  } | null;
  intermediaries: {
    active: number;
    underOnboarding: number;
    pendingApplications: number;
  } | null;
  commercial: {
    projectedPayinMtd: number;
    payinAfterTdsMtd: number;
    partnerPayoutMtd: number;
    retentionMtd: number;
    retentionRate: number;
    payinPoliciesMtd: number;
    payoutPoliciesMtd: number;
    needsReviewMtd: number;
    receivableOutstanding: number;
    overdueReceivable: number;
    overdueInvoices: number;
    partnerPayableOutstanding: number;
    openPartnerPayables: number;
  } | null;
  warnings: string[];
};

const closedClaimStatuses = new Set(["Claim Complete", "Settled", "Closed", "Rejected"]);
const settledClaimStatuses = new Set(["Settled", "Claim Complete"]);
const openIntermediaryQueueStatuses = new Set(["submitted", "under_review", "changes_requested"]);

export async function getDashboardCurrentData(
  profile: ProfileLike | null | undefined,
  access: DashboardAccess,
  base: OperationsDashboardData,
): Promise<DashboardCurrentData> {
  const now = new Date();
  const monthStartKey = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const todayKey = now.toISOString().slice(0, 10);
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  if (!profile?.id) {
    return {
      generatedAt: now,
      monthLabel,
      base,
      portfolio: null,
      mtd: null,
      renewals: null,
      fleet: null,
      claims: null,
      tasks: null,
      policyIntakes: null,
      intermediaries: null,
      commercial: null,
      warnings: [],
    };
  }

  const admin = createSupabaseAdminClient();
  const warnings: string[] = [];

  const [policyCustomerIds, vehicleCustomerIds, claimCustomerIds, taskCustomerIds, intermediaryIds, intermediaryApplicationIds] = await Promise.all([
    access.viewPolicies ? getAccessibleCustomerIds(profile.id, profile.role, "view_policies") : Promise.resolve([]),
    access.viewVehicles ? getAccessibleCustomerIds(profile.id, profile.role, "view_vehicles") : Promise.resolve([]),
    access.viewClaims ? getAccessibleCustomerIds(profile.id, profile.role, "view_claims") : Promise.resolve([]),
    access.viewTasks ? getAccessibleCustomerIds(profile.id, profile.role, "view_tasks") : Promise.resolve([]),
    access.viewIntermediaries ? getAccessibleIntermediaryIds(profile.id, profile.role, "view_intermediaries") : Promise.resolve([]),
    access.viewIntermediaries ? getAccessibleIntermediaryApplicationIds(profile.id, profile.role, "view_intermediaries") : Promise.resolve([]),
  ]);

  const policyRequest = access.viewPolicies && policyCustomerIds?.length !== 0
    ? (() => {
        let query = admin
          .from("policies")
          .select("id,customer_id,vehicle_id,insurance_company_id,policy_type,business_line,business_type,policy_product,status,issuance_date,created_at,end_date,intermediary_type,intermediary_code,lead_source,intermediary_group_id,intermediary_group_name")
          .limit(15000);
        if (policyCustomerIds !== null) query = query.in("customer_id", policyCustomerIds);
        return query.returns<PolicyRow[]>();
      })()
    : Promise.resolve({ data: [] as PolicyRow[], error: null });

  const vehicleRequest = access.viewVehicles && vehicleCustomerIds?.length !== 0
    ? (() => {
        let query = admin
          .from("vehicles")
          .select("id,customer_id,vehicle_no,vehicle_type,registration_status,authbridge_verified")
          .limit(15000);
        if (vehicleCustomerIds !== null) query = query.in("customer_id", vehicleCustomerIds);
        return query.returns<VehicleRow[]>();
      })()
    : Promise.resolve({ data: [] as VehicleRow[], error: null });

  const claimRequest = access.viewClaims && claimCustomerIds?.length !== 0
    ? (() => {
        let query = admin
          .from("claims")
          .select("id,vehicle_id,claim_no,current_status,created_at,updated_at,assistance_status,claim_service_mode,policy_service_source,estimated_loss,approved_amount,settlement_amount,customers(company_name,contact_name),vehicles(vehicle_no)")
          .order("updated_at", { ascending: false })
          .limit(10000);
        if (claimCustomerIds !== null) query = query.in("customer_id", claimCustomerIds);
        return query.returns<ClaimRow[]>();
      })()
    : Promise.resolve({ data: [] as ClaimRow[], error: null });

  const intermediaryRequest = access.viewIntermediaries && intermediaryIds?.length !== 0
    ? (() => {
        let query = admin
          .from("intermediaries")
          .select("id,intermediary_code,intermediary_type,display_name,account_status")
          .limit(5000);
        if (intermediaryIds !== null) query = query.in("id", intermediaryIds);
        return query.returns<IntermediaryRow[]>();
      })()
    : Promise.resolve({ data: [] as IntermediaryRow[], error: null });

  const onboardingRequest = access.viewIntermediaries && intermediaryApplicationIds?.length !== 0
    ? (() => {
        let query = admin
          .from("intermediary_onboarding_applications")
          .select("id,status,registration_status,partner_status,final_type,draft_data")
          .limit(5000);
        if (intermediaryApplicationIds !== null) query = query.in("id", intermediaryApplicationIds);
        return query.returns<OnboardingRow[]>();
      })()
    : Promise.resolve({ data: [] as OnboardingRow[], error: null });

  const intakeRequest = access.viewPolicyIntakes
    ? (() => {
        let query = admin
          .from("policy_intake_requests")
          .select("id,intake_number,status,ocr_status,lead_source_name,customer_mobile,attention_reason,created_at,updated_at")
          .order("created_at", { ascending: false })
          .limit(500);
        if (!access.reviewPolicyIntakes) query = query.eq("submitted_by_profile_id", profile.id);
        return query.returns<DashboardIntakeRow[]>();
      })()
    : Promise.resolve({ data: [] as DashboardIntakeRow[], error: null });

  const [policyResult, vehicleResult, claimResult, intermediaryResult, onboardingResult, intakeResult] = await Promise.all([
    policyRequest,
    vehicleRequest,
    claimRequest,
    intermediaryRequest,
    onboardingRequest,
    intakeRequest,
  ]);

  if (policyResult.error) warnings.push("Policy analytics could not be refreshed.");
  if (vehicleResult.error) warnings.push("Fleet readiness could not be refreshed.");
  if (claimResult.error) warnings.push("Claim analytics could not be refreshed.");
  if (intermediaryResult.error || onboardingResult.error) warnings.push("Intermediary analytics could not be refreshed.");
  if (intakeResult.error) warnings.push("Policy Intake analytics could not be refreshed.");

  const policies = policyResult.data ?? [];
  const vehicles = vehicleResult.data ?? [];
  const claims = claimResult.data ?? [];
  const intermediaries = intermediaryResult.data ?? [];
  const intakes = intakeResult.data ?? [];

  const mtdPolicies = policies.filter((row) => {
    const effectiveDate = row.issuance_date || row.created_at.slice(0, 10);
    return effectiveDate >= monthStartKey && effectiveDate <= todayKey;
  });

  const premiumMap = new Map<string, { gross: number; net: number }>();
  if (access.commercial && mtdPolicies.length) {
    const premiumResult = await admin
      .from("policy_premium_details")
      .select("policy_id,net_premium,gross_premium")
      .in("policy_id", mtdPolicies.map((row) => row.id))
      .returns<PremiumRow[]>();
    if (premiumResult.error) warnings.push("MTD premium figures could not be refreshed.");
    else {
      for (const row of premiumResult.data ?? []) {
        premiumMap.set(row.policy_id, { gross: numberValue(row.gross_premium), net: numberValue(row.net_premium) });
      }
    }
  }

  const vehicleById = new Map(vehicles.map((row) => [row.id, row]));
  const intermediaryByCode = new Map(
    intermediaries
      .filter((row) => row.intermediary_code)
      .map((row) => [row.intermediary_code as string, row]),
  );

  const insurerIds = Array.from(new Set(
    mtdPolicies.map((row) => row.insurance_company_id).filter((value): value is string => Boolean(value)),
  ));
  const insurerMap = new Map<string, string>();
  if (insurerIds.length) {
    const insurerResult = await admin
      .from("insurance_companies")
      .select("id,name")
      .in("id", insurerIds)
      .returns<InsurerRow[]>();
    if (insurerResult.error) warnings.push("MTD insurer mix could not be refreshed.");
    else for (const row of insurerResult.data ?? []) insurerMap.set(row.id, row.name);
  }

  const channel = new Map<string, AmountAccumulator>();
  const vehicleClass = new Map<string, AmountAccumulator>();
  const coverage = new Map<string, AmountAccumulator>();
  const businessLine = new Map<string, AmountAccumulator>();
  const insurers = new Map<string, AmountAccumulator>();
  const producers = new Map<string, AmountAccumulator & { detail: string | null }>();
  const groups = new Map<string, AmountAccumulator & { detail: string | null }>();

  for (const policy of mtdPolicies) {
    const premium = premiumMap.get(policy.id)?.gross ?? 0;
    addAmount(channel, cleanLabel(policy.intermediary_type, "Direct"), premium);
    const vehicle = policy.vehicle_id ? vehicleById.get(policy.vehicle_id) : null;
    addAmount(vehicleClass, vehicle?.vehicle_type || (policy.business_line === "Non Motor" ? "Non-Motor" : "Unclassified"), premium);
    addAmount(coverage, cleanLabel(policy.policy_type, "Unspecified"), premium);
    addAmount(businessLine, cleanLabel(policy.business_line, "Unspecified"), premium);

    if (policy.insurance_company_id) {
      addAmount(insurers, policy.insurance_company_id, premium);
    }

    const producerCode = policy.intermediary_code || "direct";
    const producer = intermediaryByCode.get(producerCode);
    const producerRow = producers.get(producerCode) ?? {
      policies: 0,
      amount: 0,
      label: producer?.display_name || policy.lead_source || producerCode,
      detail: producer?.intermediary_type || policy.intermediary_type,
    };
    producerRow.policies += 1;
    producerRow.amount += premium;
    producers.set(producerCode, producerRow);

    if (policy.intermediary_group_id || policy.intermediary_group_name) {
      const key = policy.intermediary_group_id || policy.intermediary_group_name || "group";
      const groupRow = groups.get(key) ?? {
        policies: 0,
        amount: 0,
        label: policy.intermediary_group_name || "Intermediary Group",
        detail: null,
      };
      groupRow.policies += 1;
      groupRow.amount += premium;
      groups.set(key, groupRow);
    }
  }

  const grossPremium = access.commercial
    ? Array.from(premiumMap.values()).reduce((sum, item) => sum + item.gross, 0)
    : null;
  const netPremium = access.commercial
    ? Array.from(premiumMap.values()).reduce((sum, item) => sum + item.net, 0)
    : null;

  const topInsurers = access.commercial
    ? Array.from(insurers.entries())
        .map(([id, item]) => ({
          key: id,
          label: insurerMap.get(id) || "Insurance company",
          detail: null,
          policies: item.policies,
          amount: item.amount,
        }))
        .sort(amountRank)
        .slice(0, 5)
    : [];

  const topProducers = access.commercial
    ? Array.from(producers.entries())
        .map(([key, item]) => ({ key, label: item.label, detail: item.detail, policies: item.policies, amount: item.amount }))
        .sort(amountRank)
        .slice(0, 6)
    : [];

  const topGroups = access.commercial
    ? Array.from(groups.entries())
        .map(([key, item]) => ({ key, label: item.label, detail: item.detail, policies: item.policies, amount: item.amount }))
        .sort(amountRank)
        .slice(0, 5)
    : [];

  const portfolio = access.viewPolicies && !policyResult.error
    ? (() => {
        const normalized = policies.map((row) => (row.business_line ?? "").trim().toLowerCase().replaceAll("-", " "));
        const motor = normalized.filter((value) => value === "motor").length;
        const life = normalized.filter((value) => value === "life").length;
        const nonMotor = normalized.filter((value) => value === "non motor").length;
        const health = normalized.filter((value) => value === "health").length;
        return {
          total: policies.length,
          active: policies.filter((row) => row.end_date >= todayKey).length,
          motor,
          life,
          nonMotor,
          health,
          other: Math.max(policies.length - motor - life - nonMotor - health, 0),
        };
      })()
    : null;

  const renewals = access.viewPolicies && !policyResult.error
    ? buildRenewalHorizon(policies, now)
    : null;

  const fleet = access.viewVehicles && !vehicleResult.error
    ? buildFleetReadiness(vehicles)
    : null;

  let claimHealth: DashboardCurrentData["claims"] = null;
  if (access.viewClaims && !claimResult.error) {
    const internalClaims = claims.filter((row) => row.policy_service_source !== "external");
    const internalOpenClaims = internalClaims.filter((row) => !closedClaimStatuses.has(row.current_status));
    const internalSettledClaims = internalClaims.filter((row) => settledClaimStatuses.has(row.current_status));
    const internalOpenIds = internalOpenClaims.map((row) => row.id);
    const openClaims = claims.filter((row) => !closedClaimStatuses.has(row.current_status));
    const openIds = openClaims.map((row) => row.id);
    const financialClaimIds = Array.from(new Set([
      ...openIds,
      ...internalSettledClaims.map((row) => row.id),
    ]));
    let financialRows: ClaimFinancialRow[] = [];
    let pendingDocuments = 0;

    const [financialResult, stageDetailResult, documentResult] = await Promise.all([
      financialClaimIds.length
        ? admin
            .from("claim_financials")
            .select("claim_id,estimate_amount,approved_amount,bill_amount,do_amount,payment_received_amount")
            .in("claim_id", financialClaimIds)
            .returns<ClaimFinancialRow[]>()
        : Promise.resolve({ data: [] as ClaimFinancialRow[], error: null }),
      internalOpenIds.length
        ? admin
            .from("claim_stage_details")
            .select("claim_id,details,created_at")
            .in("claim_id", internalOpenIds)
            .order("created_at", { ascending: false })
            .limit(5000)
            .returns<ClaimStageDetailRow[]>()
        : Promise.resolve({ data: [] as ClaimStageDetailRow[], error: null }),
      openIds.length
        ? admin
            .from("claim_documents")
            .select("id", { count: "exact", head: true })
            .in("claim_id", openIds)
            .in("verification_status", ["pending", "rejected"])
        : Promise.resolve({ count: 0, error: null }),
    ]);
    if (financialResult.error) warnings.push("Claim financial exposure could not be refreshed.");
    else financialRows = financialResult.data ?? [];
    if (stageDetailResult.error) warnings.push("Claim stage amounts could not be refreshed.");
    if (documentResult.error) warnings.push("Claim document review count could not be refreshed.");
    else pendingDocuments = documentResult.count ?? 0;

    const financialByClaim = new Map(financialRows.map((row) => [row.claim_id, row]));
    const stageAmountsByClaim = buildLatestClaimStageAmounts(stageDetailResult.data ?? []);
    const actionPendingVehicles = new Set(
      openClaims.map((row) => row.vehicle_id).filter((vehicleId): vehicleId is string => Boolean(vehicleId)),
    ).size;
    const estimateExposure = sumClaimFinancial(openClaims, financialByClaim, "estimate_amount", "estimated_loss");
    const internalOpenAmount = internalOpenClaims.reduce(
      (sum, claim) => sum + currentOpenClaimAmount(claim, stageAmountsByClaim, financialByClaim),
      0,
    );
    const internalSettledAmountReceived = sumClaimFinancial(
      internalSettledClaims,
      financialByClaim,
      "payment_received_amount",
    );
    claimHealth = {
      open: internalOpenClaims.length,
      settled: internalSettledClaims.length,
      openAmount: internalOpenAmount,
      settledAmount: internalSettledAmountReceived,
      mtd: claims.filter((row) => row.created_at.slice(0, 10) >= monthStartKey).length,
      assistanceRequested: openClaims.filter((row) => row.assistance_status === "requested").length,
      pendingDocuments,
      actionPendingVehicles,
      estimateExposure,
      approvedExposure: sumClaimFinancial(openClaims, financialByClaim, "approved_amount", "approved_amount"),
      billExposure: sumClaimFinancial(openClaims, financialByClaim, "bill_amount"),
      doExposure: sumClaimFinancial(openClaims, financialByClaim, "do_amount", "settlement_amount"),
      paymentReceived: sumClaimFinancial(openClaims, financialByClaim, "payment_received_amount"),
      aging: buildClaimAging(openClaims, now),
      recent: claims.slice(0, 5).map((row) => ({
        id: row.id,
        claim_no: row.claim_no,
        current_status: row.current_status,
        updated_at: row.updated_at,
        customerName: row.customers?.company_name || row.customers?.contact_name || "Customer",
        vehicleNo: row.vehicles?.vehicle_no ?? null,
      })),
    };
  }

  let tasks: DashboardCurrentData["tasks"] = null;
  if (access.viewTasks) {
    let taskClaimIds: string[] = [];
    let taskClaimError = false;
    if (taskCustomerIds === null) {
      const result = await admin.from("claims").select("id").limit(15000).returns<Array<{ id: string }>>();
      taskClaimError = Boolean(result.error);
      taskClaimIds = (result.data ?? []).map((row) => row.id);
    } else if (taskCustomerIds.length) {
      const result = await admin.from("claims").select("id").in("customer_id", taskCustomerIds).limit(15000).returns<Array<{ id: string }>>();
      taskClaimError = Boolean(result.error);
      taskClaimIds = (result.data ?? []).map((row) => row.id);
    }

    if (taskClaimError) warnings.push("Task scope could not be refreshed.");
    else if (!taskClaimIds.length) tasks = { open: 0, overdue: 0 };
    else {
      const taskResult = await admin
        .from("claim_tasks")
        .select("id,status,due_date")
        .in("claim_id", taskClaimIds)
        .returns<Array<{ id: string; status: string; due_date: string | null }>>();
      if (taskResult.error) warnings.push("Task totals could not be refreshed.");
      else {
        const openRows = (taskResult.data ?? []).filter((row) => ["open", "in_progress"].includes(row.status));
        tasks = {
          open: openRows.length,
          overdue: openRows.filter((row) => Boolean(row.due_date) && row.due_date! < todayKey).length,
        };
      }
    }
  }

  const policyIntakes = access.viewPolicyIntakes && !intakeResult.error
    ? (() => {
        const actionRequired = intakes.filter(
          (row) =>
            row.status === "ready_for_review" ||
            row.status === "needs_attention" ||
            (row.status === "processing" && row.ocr_status === "failed"),
        ).length;
        const inReview = intakes.filter((row) => row.status === "in_review").length;
        const processing = intakes.filter(
          (row) => row.status === "processing" && row.ocr_status !== "failed",
        ).length;
        return {
          active: intakes.filter((row) => ["ready_for_review", "in_review", "processing", "needs_attention"].includes(row.status)).length,
          actionRequired,
          inReview,
          processing,
          workload: actionRequired + inReview + processing,
          needsAttention: intakes.filter((row) => row.status === "needs_attention").length,
          ocrFailed: intakes.filter((row) => row.status === "processing" && row.ocr_status === "failed").length,
          recent: intakes.filter((row) => !["completed", "rejected"].includes(row.status)).slice(0, 5),
        };
      })()
    : null;

  let pendingApplications = 0;
  let pendingApplicationLoadError = false;
  if (access.viewIntermediaries && !onboardingResult.error) {
    const pendingCandidates = (onboardingResult.data ?? []).filter((row) => {
      if (!openIntermediaryQueueStatuses.has(row.status)) return false;
      if (row.partner_status === "active_partner") return false;
      if (accountContext(row.draft_data) !== "partner") return false;
      if (row.final_type === "partner") return false;
      return (row.registration_status ?? "").trim().toLowerCase() === "documents_pending";
    });
    const candidateIds = pendingCandidates.map((row) => row.id);

    if (candidateIds.length) {
      const [profileResult, documentResult] = await Promise.all([
        admin
          .from("posp_misp_onboarding_profiles")
          .select("application_id,workflow_stage,gst_number")
          .in("application_id", candidateIds)
          .returns<OnboardingProfileRow[]>(),
        admin
          .from("intermediary_onboarding_documents")
          .select("application_id,document_type,file_name,document_label")
          .in("application_id", candidateIds)
          .returns<OnboardingDocumentRow[]>(),
      ]);

      pendingApplicationLoadError = Boolean(profileResult.error || documentResult.error);
      if (!pendingApplicationLoadError) {
        const profileByApplicationId = new Map((profileResult.data ?? []).map((row) => [row.application_id, row]));
        const documentsByApplicationId = new Map<string, OnboardingDocumentRow[]>();
        for (const document of documentResult.data ?? []) {
          const current = documentsByApplicationId.get(document.application_id) ?? [];
          current.push(document);
          documentsByApplicationId.set(document.application_id, current);
        }

        pendingApplications = pendingCandidates.filter((row) => {
          const queueProfile = profileByApplicationId.get(row.id);
          if (!queueProfile || queueProfile.workflow_stage !== "iib_processing") return false;
          const queueDocuments = documentsByApplicationId.get(row.id) ?? [];
          const slots = buildIntermediaryDocumentSlots({
            legacy: false,
            hasGst: Boolean(queueProfile.gst_number?.trim()),
            documents: queueDocuments,
          });
          return slots
            .filter((slot) => slot.required)
            .some((slot) => !queueDocuments.some((document) => document.document_type === slot.key && Boolean(document.file_name?.trim())));
        }).length;
      }
    }
  }
  if (pendingApplicationLoadError) warnings.push("Pending intermediary application count could not be refreshed.");

  const intermediarySummary = access.viewIntermediaries && !intermediaryResult.error && !onboardingResult.error
    ? {
        active: intermediaries.filter((row) => row.account_status === "active").length,
        underOnboarding: intermediaries.filter((row) => row.account_status === "under_onboarding").length,
        pendingApplications,
      }
    : null;

  let commercial: DashboardCurrentData["commercial"] = null;
  if (access.viewAccounts && access.commercial) {
    const mtdPolicyIds = mtdPolicies.map((row) => row.id);
    const [payinResult, payoutResult, receivableResult, invoiceResult, payableResult] = await Promise.all([
      mtdPolicyIds.length
        ? admin
            .from("policy_payin_details")
            .select("policy_id,total_projected_payin,payin_after_tds,commercial_status")
            .in("policy_id", mtdPolicyIds)
            .returns<PayinRow[]>()
        : Promise.resolve({ data: [] as PayinRow[], error: null }),
      mtdPolicyIds.length
        ? admin
            .from("policy_intermediary_payouts")
            .select("policy_id,gross_payout,partner_payout_amount,retention_amount,commercial_status,status")
            .in("policy_id", mtdPolicyIds)
            .returns<PayoutRow[]>()
        : Promise.resolve({ data: [] as PayoutRow[], error: null }),
      admin.from("accounts_receivable_entries").select("debit_amount,credit_amount").limit(5000).returns<ReceivableRow[]>(),
      admin.from("accounts_invoices").select("id,outstanding_amount,due_date").gt("outstanding_amount", 0).limit(2000).returns<InvoiceRow[]>(),
      admin.from("partner_payables").select("id,outstanding_amount,status").gt("outstanding_amount", 0).limit(2000).returns<PayableRow[]>(),
    ]);

    if (payinResult.error || payoutResult.error) warnings.push("MTD commercial operations could not be refreshed.");
    if (receivableResult.error || invoiceResult.error || payableResult.error) warnings.push("Accounts outstanding figures could not be refreshed.");

    if (!payinResult.error && !payoutResult.error && !receivableResult.error && !invoiceResult.error && !payableResult.error) {
      const payins = payinResult.data ?? [];
      const payouts = payoutResult.data ?? [];
      const projectedPayinMtd = payins.reduce((sum, row) => sum + numberValue(row.total_projected_payin), 0);
      const payinAfterTdsMtd = payins.reduce((sum, row) => sum + numberValue(row.payin_after_tds), 0);
      const partnerPayoutMtd = payouts.reduce((sum, row) => sum + payoutValue(row), 0);
      const retentionMtd = payouts.reduce((sum, row) => sum + numberValue(row.retention_amount), 0);
      const overdueInvoices = (invoiceResult.data ?? []).filter((row) => row.due_date && row.due_date < todayKey);
      commercial = {
        projectedPayinMtd,
        payinAfterTdsMtd,
        partnerPayoutMtd,
        retentionMtd,
        retentionRate: payinAfterTdsMtd > 0 ? (retentionMtd / payinAfterTdsMtd) * 100 : 0,
        payinPoliciesMtd: new Set(payins.map((row) => row.policy_id)).size,
        payoutPoliciesMtd: new Set(payouts.map((row) => row.policy_id)).size,
        needsReviewMtd:
          payins.filter((row) => row.commercial_status === "needs_review").length +
          payouts.filter((row) => row.commercial_status === "needs_review").length,
        receivableOutstanding: (receivableResult.data ?? []).reduce(
          (sum, row) => sum + numberValue(row.debit_amount) - numberValue(row.credit_amount),
          0,
        ),
        overdueReceivable: overdueInvoices.reduce((sum, row) => sum + numberValue(row.outstanding_amount), 0),
        overdueInvoices: overdueInvoices.length,
        partnerPayableOutstanding: (payableResult.data ?? []).reduce((sum, row) => sum + numberValue(row.outstanding_amount), 0),
        openPartnerPayables: (payableResult.data ?? []).length,
      };
    }
  }

  return {
    generatedAt: now,
    monthLabel,
    base,
    portfolio,
    mtd: access.viewPolicies && !policyResult.error
      ? {
          policies: mtdPolicies.length,
          grossPremium,
          netPremium,
          averageGrossPremium: access.commercial && mtdPolicies.length ? (grossPremium ?? 0) / mtdPolicies.length : null,
          activeProducers: new Set(mtdPolicies.map((row) => row.intermediary_code).filter(Boolean)).size,
          channelMix: amountMix(channel, access.commercial),
          vehicleClassMix: amountMix(vehicleClass, access.commercial),
          coverageMix: amountMix(coverage, access.commercial),
          businessLineMix: amountMix(businessLine, access.commercial),
          topInsurers,
          topProducers,
          topGroups,
        }
      : null,
    renewals,
    fleet,
    claims: claimHealth,
    tasks,
    policyIntakes,
    intermediaries: intermediarySummary,
    commercial,
    warnings,
  };
}

type AmountAccumulator = { label: string; policies: number; amount: number };

function addAmount(map: Map<string, AmountAccumulator>, key: string, amount: number) {
  const current = map.get(key) ?? { label: key, policies: 0, amount: 0 };
  current.policies += 1;
  current.amount += amount;
  map.set(key, current);
}

function amountMix(map: Map<string, AmountAccumulator>, commercial: boolean): AmountMixRow[] {
  return Array.from(map.entries())
    .map(([key, item]) => ({
      key,
      label: item.label,
      policies: item.policies,
      amount: commercial ? item.amount : null,
    }))
    .sort((a, b) => commercial
      ? (b.amount ?? 0) - (a.amount ?? 0) || b.policies - a.policies
      : b.policies - a.policies)
    .slice(0, 6);
}

function amountRank(a: RankedBusinessRow, b: RankedBusinessRow) {
  return b.amount - a.amount || b.policies - a.policies || a.label.localeCompare(b.label);
}

function buildRenewalHorizon(rows: PolicyRow[], now: Date) {
  const today = now.toISOString().slice(0, 10);
  const plus7 = addDaysKey(now, 7);
  const plus15 = addDaysKey(now, 15);
  const plus30 = addDaysKey(now, 30);
  const plus45 = addDaysKey(now, 45);
  return {
    expired: rows.filter((row) => row.end_date < today).length,
    due0to7: rows.filter((row) => row.end_date >= today && row.end_date <= plus7).length,
    due8to15: rows.filter((row) => row.end_date > plus7 && row.end_date <= plus15).length,
    due16to30: rows.filter((row) => row.end_date > plus15 && row.end_date <= plus30).length,
    due31to45: rows.filter((row) => row.end_date > plus30 && row.end_date <= plus45).length,
  };
}

function addDaysKey(value: Date, days: number) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function accountContext(draft: Record<string, unknown> | null | undefined) {
  const context = draft?.account_context;
  return context === "posp" || context === "misp" ? context : "partner";
}

function buildFleetReadiness(rows: VehicleRow[]) {
  let registered = 0;
  let registrationPending = 0;
  let incompleteLegacy = 0;
  let authbridgeVerified = 0;

  for (const row of rows) {
    const vehicleNo = (row.vehicle_no ?? "").trim().toUpperCase();
    const status = (row.registration_status ?? "").trim().toLowerCase();
    const temporary = vehicleNo.startsWith("NEW-") || vehicleNo.startsWith("PENDING-");
    if (status === "registration_pending" || temporary) registrationPending += 1;
    else if (vehicleNo) registered += 1;
    else incompleteLegacy += 1;
    if (row.authbridge_verified) authbridgeVerified += 1;
  }

  return { total: rows.length, registered, registrationPending, incompleteLegacy, authbridgeVerified };
}

function buildClaimAging(rows: ClaimRow[], now: Date) {
  const buckets = [
    { label: "<3 days", min: 0, max: 2, tone: "bg-[#23B7AE]" },
    { label: "3–7 days", min: 3, max: 7, tone: "bg-[#4C9DD1]" },
    { label: "8–15 days", min: 8, max: 15, tone: "bg-[#685BE3]" },
    { label: "16–30 days", min: 16, max: 30, tone: "bg-[#D99A3B]" },
    { label: ">30 days", min: 31, max: Number.POSITIVE_INFINITY, tone: "bg-[#EE695F]" },
  ];
  return buckets.map((bucket) => ({
    label: bucket.label,
    tone: bucket.tone,
    value: rows.filter((row) => {
      const age = Math.max(0, Math.floor((now.getTime() - Date.parse(row.created_at)) / 86400000));
      return age >= bucket.min && age <= bucket.max;
    }).length,
  }));
}

type OpenClaimStageAmounts = {
  estimateAmount: unknown;
  billAmount: unknown;
  doAmount: unknown;
};

const billAmountStatuses = new Set(["Final Bill Submitted", "DO Status"]);
const doAmountStatuses = new Set(["DO Submitted", "Payment Stage", "Claim Completion In Progress", "Settlement Under Process"]);

function buildLatestClaimStageAmounts(rows: ClaimStageDetailRow[]) {
  const byClaim = new Map<string, OpenClaimStageAmounts>();
  for (const row of rows) {
    const details = row.details;
    const milestoneKey = typeof details?.milestone_key === "string" ? details.milestone_key : "";
    if (!["claim_intimation", "billing", "delivery_order"].includes(milestoneKey)) continue;

    const current = byClaim.get(row.claim_id) ?? { estimateAmount: null, billAmount: null, doAmount: null };
    if (milestoneKey === "claim_intimation" && !hasRecordedFinancialValue(current.estimateAmount)) {
      current.estimateAmount = details?.estimate_amount;
    }
    if (milestoneKey === "billing" && !hasRecordedFinancialValue(current.billAmount)) {
      current.billAmount = details?.bill_amount;
    }
    if (milestoneKey === "delivery_order" && !hasRecordedFinancialValue(current.doAmount)) {
      current.doAmount = details?.do_amount;
    }
    byClaim.set(row.claim_id, current);
  }
  return byClaim;
}

function currentOpenClaimAmount(
  claim: ClaimRow,
  stageMap: Map<string, OpenClaimStageAmounts>,
  financialMap: Map<string, ClaimFinancialRow>,
) {
  const stageAmounts = stageMap.get(claim.id);
  const financial = financialMap.get(claim.id);

  if (doAmountStatuses.has(claim.current_status)) {
    if (hasRecordedFinancialValue(stageAmounts?.doAmount)) return numberValue(stageAmounts?.doAmount);
    if (hasRecordedFinancialValue(financial?.do_amount)) return numberValue(financial?.do_amount);
  }

  if (billAmountStatuses.has(claim.current_status)) {
    if (hasRecordedFinancialValue(stageAmounts?.billAmount)) return numberValue(stageAmounts?.billAmount);
    if (hasRecordedFinancialValue(financial?.bill_amount)) return numberValue(financial?.bill_amount);
  }

  if (hasRecordedFinancialValue(stageAmounts?.estimateAmount)) return numberValue(stageAmounts?.estimateAmount);
  if (hasRecordedFinancialValue(financial?.estimate_amount)) return numberValue(financial?.estimate_amount);
  return numberValue(claim.estimated_loss);
}

function hasRecordedFinancialValue(value: unknown) {
  if (value === null || value === undefined || value === "") return false;
  const parsed = Number(value);
  return Number.isFinite(parsed);
}

function sumClaimFinancial(
  claims: ClaimRow[],
  map: Map<string, ClaimFinancialRow>,
  key: keyof Omit<ClaimFinancialRow, "claim_id">,
  fallbackKey?: "estimated_loss" | "approved_amount" | "settlement_amount",
) {
  return claims.reduce((sum, claim) => {
    const direct = numberValue(map.get(claim.id)?.[key]);
    return sum + (direct !== 0 || !fallbackKey ? direct : numberValue(claim[fallbackKey]));
  }, 0);
}

function payoutValue(row: PayoutRow) {
  const partnerAmount = numberValue(row.partner_payout_amount);
  return partnerAmount !== 0 ? partnerAmount : numberValue(row.gross_payout);
}

function cleanLabel(value: string | null | undefined, fallback: string) {
  const label = (value ?? "").trim();
  return label || fallback;
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}