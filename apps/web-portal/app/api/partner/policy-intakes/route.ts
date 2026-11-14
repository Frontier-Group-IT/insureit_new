import { after } from "next/server";
import { NextResponse } from "next/server";

import { createSupabaseWithAccessToken } from "@/lib/auth";
import { getServerAccessToken } from "@/lib/auth-server";
import { extractPolicyIntakeDocumentTrusted } from "@/lib/policy-intake-ocr-service";
import { extractPolicyIntakeWithN8nFallback } from "@/lib/policy-intake-n8n-router";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getPartnerEmployeeIntakeReadScope } from "@/lib/partner-policy-intake-read-access";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import type { PolicyIntakeDuplicateCandidate } from "@/lib/policy-intake-duplicate";
import { policyIntakeBucket, policyIntakeStatusCounts } from "@/lib/policy-intake-status-buckets";
import { fetchAllPages } from "@/lib/fetch-all-pages";

const BUCKET = "policy-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const POLICY_TYPES = new Set(["motor", "non_motor", "life", "health"]);
const LIFE_HEALTH_TYPES = new Set(["life", "health"]);
type PolicyType = "motor" | "non_motor" | "life" | "health";

type EmployeeIdentity = { actor_kind: "employee"; profile_id: string };
type LegacyPartnerIdentity = {
  actor_kind: "intermediary";
  portal_account_id: string;
  profile_id?: string;
  auth_user_id?: string;
  portal_account_source?: "associate";
  intermediary_id: string;
  portal_access_type?: undefined;
};
type ExplicitPortalIdentity = {
  actor_kind: "intermediary";
  profile_id: string;
  auth_user_id: string;
  portal_account_id: null;
  intermediary_id: null;
  portal_access_type: "group" | "branch";
  portal_access_entity_id: string;
};
type PartnerIdentity = EmployeeIdentity | LegacyPartnerIdentity | ExplicitPortalIdentity;

type PartnerScope = {
  intermediary_ids?: string[];
  partner_ids?: string[];
};

type UploadMeta = {
  name: string;
  type: string;
  size: number;
};

type SubmitterNamedIntake = { submitted_by_profile_id: string | null; submitted_by_portal_account_id: string | null };
async function resolveIntakeSubmitterNames<T extends SubmitterNamedIntake>(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  intakes: T[],
): Promise<Array<T & { submitted_by_name: string }>> {
  // Resolve submitter names only for records already authorized by intakeReadScope.
  // Never infer the submitter from the lead source: multiple users share that source.
  const profileIds = Array.from(new Set(intakes.map((row) => row.submitted_by_profile_id).filter((id): id is string => Boolean(id))));
  const accountIds = Array.from(new Set(intakes.map((row) => row.submitted_by_portal_account_id).filter((id): id is string => Boolean(id))));
  const [profilesResult, associatesResult, portalAccountsResult] = await Promise.all([
    profileIds.length ? admin.from("profiles").select("id,full_name").in("id", profileIds) : Promise.resolve({ data: [] as Array<{id:string;full_name:string|null}>, error: null }),
    accountIds.length ? admin.from("partner_portal_associate_accounts").select("id,name").in("id", accountIds) : Promise.resolve({ data: [] as Array<{id:string;name:string|null}>, error: null }),
    accountIds.length ? admin.from("intermediary_portal_accounts").select("id,intermediary_id").in("id", accountIds) : Promise.resolve({ data: [] as Array<{id:string;intermediary_id:string|null}>, error: null }),
  ]);
  if (profilesResult.error || associatesResult.error || portalAccountsResult.error) {
    throw new Error("Could not resolve policy intake submitters.");
  }
  // Branch records must show their designated contact, not their organization name.
  // Resolve only the identities actually present in the already authorized intake rows.
  const [branchLinksResult, branchAccessResult] = await Promise.all([
    profileIds.length
      ? admin.from("partner_branch_login_links").select("profile_id,branch_id").in("profile_id", profileIds)
      : Promise.resolve({ data: [] as Array<{profile_id:string;branch_id:string}>, error: null }),
    profileIds.length
      ? admin.from("portal_access_identities").select("profile_id,entity_id").in("profile_id", profileIds).eq("entity_type", "branch")
      : Promise.resolve({ data: [] as Array<{profile_id:string;entity_id:string}>, error: null }),
  ]);
  if (branchLinksResult.error || branchAccessResult.error) throw new Error("Could not resolve branch submitters.");
  const legacyPartnerIds = [...new Set((branchAccessResult.data ?? []).map(row => row.entity_id).filter(Boolean))];
  const legacyProfilesResult = legacyPartnerIds.length
    ? await admin.from("partner_branch_profiles").select("id,partner_id,contact_name").in("partner_id", legacyPartnerIds)
    : { data: [] as Array<{id:string;partner_id:string;contact_name:string|null}>, error: null };
  if (legacyProfilesResult.error) throw new Error("Could not resolve branch contacts.");
  const legacyProfileIds = [...new Set((legacyProfilesResult.data ?? []).map(row => row.id))];
  const branchIds = [...new Set((branchLinksResult.data ?? []).map(row => row.branch_id).filter(Boolean))];
  const branchConditions = [
    ...(branchIds.length ? [`id.in.(${branchIds.join(",")})`] : []),
    ...(legacyProfileIds.length ? [`legacy_branch_profile_id.in.(${legacyProfileIds.join(",")})`] : []),
  ];
  const branchResult = branchConditions.length
    ? await admin.from("partner_branches").select("id,legacy_branch_profile_id,contact_name").or(branchConditions.join(","))
    : { data: [] as Array<{id:string;legacy_branch_profile_id:string|null;contact_name:string|null}>, error: null };
  if (branchResult.error) throw new Error("Could not resolve branch contacts.");
  const contactByBranchId = new Map((branchResult.data ?? []).map(row => [row.id, row.contact_name?.trim() || ""]));
  const contactByLegacyId = new Map((branchResult.data ?? []).filter(row => row.legacy_branch_profile_id).map(row => [row.legacy_branch_profile_id!, row.contact_name?.trim() || ""]));
  const contactByLegacyPartner = new Map((legacyProfilesResult.data ?? []).map(row => [row.partner_id, contactByLegacyId.get(row.id) || row.contact_name?.trim() || ""]));
  const branchContactByProfile = new Map<string,string>();
  for (const row of branchLinksResult.data ?? []) branchContactByProfile.set(row.profile_id, contactByBranchId.get(row.branch_id) || "");
  for (const row of branchAccessResult.data ?? []) {
    if (!branchContactByProfile.get(row.profile_id)) branchContactByProfile.set(row.profile_id, contactByLegacyPartner.get(row.entity_id) || "");
  }
  const intermediaryIds = Array.from(new Set((portalAccountsResult.data ?? []).map((row) => row.intermediary_id).filter((id): id is string => Boolean(id))));
  const intermediaryResult = intermediaryIds.length
    ? await admin.from("intermediaries").select("id,display_name").in("id", intermediaryIds)
    : { data: [] as Array<{id:string;display_name:string|null}>, error: null };
  if (intermediaryResult.error) throw new Error("Could not resolve policy intake submitters.");
  const profileNames = new Map((profilesResult.data ?? []).map((row) => [row.id, row.full_name?.trim() || ""]));
  const accountNames = new Map((associatesResult.data ?? []).map((row) => [row.id, row.name?.trim() || ""]));
  const intermediaryNames = new Map((intermediaryResult.data ?? []).map((row) => [row.id, row.display_name?.trim() || ""]));
  for (const account of portalAccountsResult.data ?? []) {
    if (account.intermediary_id && !accountNames.has(account.id)) {
      accountNames.set(account.id, intermediaryNames.get(account.intermediary_id) || "");
    }
  }
  return intakes.map((row) => ({
    ...row,
    submitted_by_name:
      (row.submitted_by_portal_account_id ? (associatesResult.data ?? []).find(account => account.id === row.submitted_by_portal_account_id)?.name?.trim() : "")
      || (row.submitted_by_profile_id ? branchContactByProfile.get(row.submitted_by_profile_id) : "")
      || (row.submitted_by_profile_id ? profileNames.get(row.submitted_by_profile_id) : "")
      || (row.submitted_by_portal_account_id ? accountNames.get(row.submitted_by_portal_account_id) : "")
      || "Unknown submitter",
  }));

}

type RequestBody =
  | { action: "prepare"; lead_source_id?: string; policy_type: PolicyType; customer_mobile: string; file: UploadMeta }
  | { action: "complete"; id: string; number: string; lead_source_id?: string; policy_type: PolicyType; customer_mobile: string; storage_path: string; file: UploadMeta }
  | { action: "submit_without_proposal"; lead_source_id?: string; policy_type: "life" | "health"; customer_mobile: string }
  | { action: "prepare_response"; id: string; file: UploadMeta }
  | { action: "complete_response"; id: string; storage_path: string; file: UploadMeta }
  | { action: "review_status"; id: string; status: "needs_attention" | "rejected"; reason: string };

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const identity = auth.identity;
  const scope = auth.scope;
  const admin = createSupabaseAdminClient();
  const intakeSelect = "id,intake_number,status,policy_type,lead_source_name,lead_source_type,lead_source_code,customer_mobile,file_name,ocr_status,ocr_fields,ocr_warnings,attention_reason,created_at,updated_at,final_policy_id,submitted_by_profile_id,submitted_by_portal_account_id";
  const url = new URL(request.url);
  const requestedId = url.searchParams.get("id")?.trim();
  const view = url.searchParams.get("view")?.trim().toLowerCase();
  // Read access follows the authenticated Partner's permitted lead sources,
  // including records submitted by Operations on behalf of that Partner.
  // Write operations below deliberately remain submitter-scoped.
  // A branch may select its parent Partner for new submissions, but that shared
  // parent source must not expose sibling branches' existing submissions.
  const readableSourceIds = isExplicitPortalIdentity(identity) && identity.portal_access_type === "branch"
    ? (scope.intermediary_ids ?? [])
    : await authorizedSourceIds(identity, scope);
  const submitterId = submittedByProfileId(identity);
  const portalAccountId = legacyPortalAccountId(identity);
  const employeeRead = identity.actor_kind === "employee"
    ? await getPartnerEmployeeIntakeReadScope(identity)
    : null;
  const intakeReadScope = [
    ...(readableSourceIds.length ? [`lead_source_id.in.(${readableSourceIds.join(",")})`] : []),
    ...(submitterId ? [`submitted_by_profile_id.eq.${submitterId}`] : []),
    ...(!submitterId && isLegacyPartnerIdentity(identity) ? [`submitted_by_portal_account_id.eq.${portalAccountId}`] : []),
  ].join(",");


  if (view === "sources") {
    const sourceIds = await authorizedSourceIds(identity, scope);
    const { data: sources, error: sourcesError } = sourceIds.length
      ? await admin
          .from("intermediaries")
          .select("id,intermediary_type,display_name,intermediary_code,account_status")
          .in("id", sourceIds)
          .eq("account_status", "active")
          .order("display_name")
      : { data: [], error: null };

    if (sourcesError) return json({ ok: false, error: "Authorized lead sources could not be loaded." }, 500);
    return json({ ok: true, sources: sources ?? [] });
  }

  if ((employeeRead?.mode === "none") || (!employeeRead && !intakeReadScope)) {
    return requestedId
      ? json({ ok: false, error: "This Policy Intake is not available in your Partner account." }, 404)
      : json({ ok: true, intakes: [], total: 0, counts: view === "mobile_list" ? { action_required: 0, in_review: 0, processing: 0, completed: 0, duplicate: 0, rejected: 0, all: 0 } : { active: 0, attention: 0, progress: 0, completed: 0 } });
  }

  if (requestedId) {
    let detailQuery = admin
      .from("policy_intake_requests")
      .select(`${intakeSelect},assigned_to_profile_id`)
      .eq("id", requestedId);

    if (employeeRead?.mode === "or") detailQuery = detailQuery.or(employeeRead.predicates);
    else if (employeeRead?.mode === "submitter") detailQuery = detailQuery.eq("submitted_by_profile_id",employeeRead.profileId);
    else if (!employeeRead) detailQuery = detailQuery.or(intakeReadScope);

    const { data: intake, error: intakeError } = await detailQuery.maybeSingle();
    if (intakeError) {
      return json({ ok: false, error: "Policy Intake could not be loaded." }, 500);
    }
    if (!intake) {
      return json({ ok: false, error: "This Policy Intake is not available in your Partner account." }, 404);
    }

    // Reviewer controls are only provided to currently active, authorized employees.
    // A readable intake alone never grants Operations mutation rights.
    const access = await resolvePolicyIntakeReviewerAccess(identity);
    // Detail must use the same derived duplicate classification as the list and
    // Operations website, without changing the stored intake status.
    const duplicateCheck = await loadPolicyIntakeDuplicateMatches(admin, [intake]);
    if (!duplicateCheck.ok) {
      return json({ ok: false, error: duplicateCheck.error }, 503);
    }
    const match = duplicateCheck.matches.get(intake.id) ?? null;
    // Matching destinations follow Operations website permissions. A Partner
    // with read access to an intake must not gain access to another policy.
    const duplicate_match = match
      ? {
          kind: match.kind,
          policy_number: match.kind === "registered_policy" ? match.policyNumber : match.normalizedPolicyNumber,
          intake_number: match.kind === "earlier_intake" ? match.intakeNumber : null,
          target_path: access.can_review || access.can_finalize
            ? match.kind === "registered_policy"
              ? `/policies/${match.policyId}`
              : `/policy-intakes/${match.intakeId}`
            : null,
        }
      : null;
    // Resolve the submitter only after the intake passes the existing read-scope check.
    // Do not misidentify the lead source organization as the submitting employee.
    let submittedByName: string | null = null;
    if (intake.submitted_by_profile_id) {
      const { data } = await admin.from("profiles").select("full_name").eq("id", intake.submitted_by_profile_id).maybeSingle();
      submittedByName = data?.full_name?.trim() || null;
    } else if (intake.submitted_by_portal_account_id) {
      const { data } = await admin.from("partner_portal_associate_accounts").select("name").eq("id", intake.submitted_by_portal_account_id).maybeSingle();
      submittedByName = data?.name?.trim() || null;
    }
    Object.assign(intake, { submitted_by_name: submittedByName });
    // Read-only preflight for the Partner App. The website's handoff action remains
    // the sole authority to change reviewer assignment after a fresh conflict check.
    let reviewerConflictName: string | null = null;
    if (access.can_finalize && identity.actor_kind === "employee" &&
        intake.assigned_to_profile_id && intake.assigned_to_profile_id !== identity.profile_id &&
        ["in_review", "ready_for_review", "processing"].includes(intake.status) && !match) {
      const { data: assignedProfile, error: assignedError } = await admin.from("profiles")
        .select("full_name").eq("id", intake.assigned_to_profile_id).maybeSingle<{ full_name: string | null }>();
      if (assignedError) return json({ ok: false, error: "Could not check the current reviewer. Please retry." }, 503);
      reviewerConflictName = assignedProfile?.full_name?.trim() || "another Operations user";
    }
    // The detail view must resolve the actual submitter the same way as the
    // authorized list, never infer a person from the lead-source company.
    let namedIntake: (typeof intake) & { submitted_by_name: string };
    try {
      [namedIntake] = await resolveIntakeSubmitterNames(admin, [intake]);
    } catch {
      return json({ ok: false, error: "Could not resolve the Policy Intake submitter." }, 503);
    }
    return json({
      ok: true,
      intake: match ? { ...namedIntake, status: "duplicate" } : namedIntake,
      review_access: match ? { can_review: false, can_finalize: false } : access,
      reviewer_conflict_name: reviewerConflictName,
      reviewer_conflict_id: reviewerConflictName ? intake.assigned_to_profile_id : null,
      duplicate_match,
    });
  }

  const requestedLimit = Number(url.searchParams.get("limit") ?? "25");
  const requestedOffset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(50, Math.floor(requestedLimit))) : 25;
  const offset = Number.isFinite(requestedOffset) ? Math.max(0, Math.min(100000, Math.floor(requestedOffset))) : 0;
  const filter = url.searchParams.get("filter")?.trim().toLowerCase() ?? "all";

  const mobileFilters = ["action_required", "in_review", "processing", "completed", "duplicate", "rejected", "all"];
  if (!(view === "mobile_list" ? mobileFilters : ["all", "attention", "in_progress", "completed"]).includes(filter)) {
    return json({ ok: false, error: "Invalid Policy Intake filter." }, 400);
  }
  const search = view === "mobile_list" ? (url.searchParams.get("search") ?? "").trim().slice(0, 120) : "";
  const includeCounts = view === "mobile_list" && url.searchParams.get("include_counts") === "true";

  if (view === "mobile_list") {
    try {
      type Candidate = PolicyIntakeDuplicateCandidate & { ocr_status: string };
      // Duplicate is a computed Operations classification, not necessarily a
      // stored status. Resolve ALL visible candidates before counting/paging.
      const candidatesResult = await fetchAllPages<Candidate, unknown>((from, to) => {
        let scoped = admin.from("policy_intake_requests")
          .select("id,intake_number,status,ocr_status,ocr_fields,created_at")
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(from, to);
        if (employeeRead?.mode === "or") scoped = scoped.or(employeeRead.predicates);
        else if (employeeRead?.mode === "submitter") scoped = scoped.eq("submitted_by_profile_id", employeeRead.profileId);
        else if (!employeeRead) scoped = scoped.or(intakeReadScope);
        return scoped.returns<Candidate[]>();
      });
      if (candidatesResult.error) throw candidatesResult.error;
      const candidates = candidatesResult.data ?? [];
      const duplicates = await loadPolicyIntakeDuplicateMatches(admin, candidates);
      if (!duplicates.ok) throw new Error("Policy Intake duplicate verification failed.");
      const duplicateIds = new Set(duplicates.matches.keys());

      // Search at the database with the existing computed field. Scope never
      // changes for search, and totals always represent all matching records.
      let searchableIds: Set<string> | null = null;
      if (search) {
        const escaped = search.replace(/[%_\\]/g, (char) => "\\" + char);
        const searched = await fetchAllPages<{ id: string }, unknown>((from, to) => {
          let q = admin.from("policy_intake_requests").select("id")
            .ilike("policy_intake_search_text", `%${escaped}%`)
            .order("created_at", { ascending: false }).order("id", { ascending: false })
            .range(from, to);
          if (employeeRead?.mode === "or") q = q.or(employeeRead.predicates);
          else if (employeeRead?.mode === "submitter") q = q.eq("submitted_by_profile_id", employeeRead.profileId);
          else if (!employeeRead) q = q.or(intakeReadScope);
          return q.returns<Array<{ id: string }>>();
        });
        if (searched.error) throw searched.error;
        searchableIds = new Set((searched.data ?? []).map((row) => row.id));
      }
      const eligible = searchableIds ? candidates.filter((row) => searchableIds!.has(row.id)) : candidates;
      const counts = includeCounts ? policyIntakeStatusCounts(eligible, duplicateIds) : undefined;
      const filtered = filter === "all" ? eligible
        : eligible.filter((row) => policyIntakeBucket(row, duplicateIds.has(row.id)) === filter);
      const pageIds = filtered.slice(offset, offset + limit).map((row) => row.id);
      if (!pageIds.length) return json({ ok: true, intakes: [], total: filtered.length, ...(counts ? { counts } : {}) });
      let pageQuery = admin.from("policy_intake_requests").select(intakeSelect).in("id", pageIds);
      if (employeeRead?.mode === "or") pageQuery = pageQuery.or(employeeRead.predicates);
      else if (employeeRead?.mode === "submitter") pageQuery = pageQuery.eq("submitted_by_profile_id", employeeRead.profileId);
      else if (!employeeRead) pageQuery = pageQuery.or(intakeReadScope);
      const result = await pageQuery;
      if (result.error) throw result.error;
      const byId = new Map((result.data ?? []).map((row) => [row.id, row]));
      const intakes = pageIds.map((id) => byId.get(id)).filter((row): row is NonNullable<typeof row> => Boolean(row))
        .map((row) => duplicateIds.has(row.id) ? { ...row, status: "duplicate" } : row);
      if (intakes.length !== pageIds.length) throw new Error("Policy Intake scope changed during paging.");
      // Resolve names only after the page has passed the existing authorization scope.
      const namedIntakes = await resolveIntakeSubmitterNames(admin, intakes);
      return json({ ok: true, intakes: namedIntakes, total: filtered.length, ...(counts ? { counts } : {}) });
    } catch (cause) {
      console.error("[partner-policy-intakes] mobile classification failed", {
        category: "scoped-status-read",
        code: typeof cause === "object" && cause !== null && "code" in cause
          ? String((cause as { code?: unknown }).code ?? "unknown").slice(0, 32) : "unknown",
      });
      return json({ ok: false, error: "Policy intakes could not be loaded." }, 500);
    }
  }

  let query = admin
    .from("policy_intake_requests")
    .select(intakeSelect, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (employeeRead?.mode === "or") query = query.or(employeeRead.predicates);
  else if (employeeRead?.mode === "submitter") query = query.eq("submitted_by_profile_id", employeeRead.profileId);
  else if (!employeeRead) query = query.or(intakeReadScope);
  if (filter === "attention") query = query.eq("status", "needs_attention");
  if (filter === "completed") query = query.eq("status", "completed");
  if (filter === "in_progress") query = query.in("status", ["processing", "ready_for_review", "in_review"]);
  async function ownedCount(statuses: string[], excluded = false) {
    let countQuery = admin
      .from("policy_intake_requests")
      .select("id", { count: "exact", head: true });

    if (employeeRead?.mode === "or") countQuery = countQuery.or(employeeRead.predicates);
    else if (employeeRead?.mode === "submitter") countQuery = countQuery.eq("submitted_by_profile_id",employeeRead.profileId);
    else if (!employeeRead) countQuery = countQuery.or(intakeReadScope);

    if (statuses.length) {
      countQuery = excluded
        ? countQuery.not("status", "in", "(" + statuses.join(",") + ")")
        : countQuery.in("status", statuses);
    }

    const { count, error } = await countQuery;
    if (error) throw error;
    return count ?? 0;
  }

  try {
    const [
      listResult,
      active,
      attention,
      progress,
      completed,
    ] = await Promise.all([
      query,
      ownedCount(["completed", "rejected"], true),
      ownedCount(["needs_attention"]),
      ownedCount(["processing", "ready_for_review", "in_review"]),
      ownedCount(["completed"]),
    ]);

    if (listResult.error) throw listResult.error;

    const namedIntakes = await resolveIntakeSubmitterNames(admin, listResult.data ?? []);
    return json({
      ok: true,
      intakes: namedIntakes,
      total: listResult.count ?? 0,
      counts: { active, attention, progress, completed },
    });
  } catch {
    return json({ ok: false, error: "Policy intakes could not be loaded." }, 500);
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return json({ ok: false, error: "Invalid request." }, 400);
  }

  // Partner-owned submissions keep their established server-side account scope.
  // Employees must also hold the exact website creation right; a view-only
  // Policy Intake grant must never permit an API upload/submit/replace action.
  if (auth.identity.actor_kind === "employee" && body.action !== "review_status") {
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from("profiles")
      .select("id,role,is_active").eq("id", auth.identity.profile_id).maybeSingle();
    if (!profile?.is_active || !(await hasEffectiveCapability(profile, "create_policy_intakes", "edit"))) {
      return json({ ok: false, error: "Policy Intake creation permission is required." }, 403);
    }
  }

  if (body.action === "review_status") {
    return updateMobileIntakeReview(auth.identity, body);
  }
  if (body.action === "prepare") {
    return prepareUpload(auth.identity, auth.scope, body);
  }
  if (body.action === "complete") {
    return completeUpload(auth.identity, auth.scope, body);
  }
  if (body.action === "submit_without_proposal") {
    return submitWithoutProposal(auth.identity, auth.scope, body);
  }
  if (body.action === "prepare_response") {
    return prepareResponse(auth.identity, body);
  }
  if (body.action === "complete_response") {
    return completeResponse(auth.identity, body);
  }

  return json({ ok: false, error: "Unsupported request." }, 400);
}

type IntakeReviewAccess = { can_review: boolean; can_finalize: boolean };

async function resolvePolicyIntakeReviewerAccess(identity: PartnerIdentity): Promise<IntakeReviewAccess> {
  if (identity.actor_kind !== "employee" || !identity.profile_id) return { can_review: false, can_finalize: false };
  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin.from("profiles").select("id,role,is_active")
    .eq("id", identity.profile_id).maybeSingle<{ id: string; role: string | null; is_active: boolean | null }>();
  if (error || !profile || profile.is_active !== true) return { can_review: false, can_finalize: false };
  const head = profile.role === "operations_head_life";
  const [review, finalize] = await Promise.all([
    head ? Promise.resolve(true) : hasEffectiveCapability(profile, "review_policy_intakes", "edit"),
    head ? Promise.resolve(true) : hasEffectiveCapability(profile, "finalize_policy_intakes", "approve"),
  ]);
  return { can_review: review, can_finalize: review && finalize };
}

async function updateMobileIntakeReview(
  identity: PartnerIdentity,
  body: { id: string; status: "needs_attention" | "rejected"; reason: string },
) {
  // Do not accept an intermediary's ability to read an intake as permission to review it.
  const access = await resolvePolicyIntakeReviewerAccess(identity);
  if (!access.can_review || identity.actor_kind !== "employee") {
    return json({ ok: false, error: "Operations review permission is required." }, 403);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id ?? "")) {
    return json({ ok: false, error: "Invalid Policy Intake reference." }, 400);
  }
  if (!["needs_attention", "rejected"].includes(body.status)) {
    return json({ ok: false, error: "Invalid review action." }, 400);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length > 2000) return json({ ok: false, error: "Add a short reason (up to 2,000 characters)." }, 400);
  const readScope = await getPartnerEmployeeIntakeReadScope(identity);
  if (readScope.mode === "none") return json({ ok: false, error: "This intake is outside your permitted scope." }, 403);
  const admin = createSupabaseAdminClient();
  // Enforce the same duplicate protection used by the Operations Review page.
  let readable = admin.from("policy_intake_requests")
    .select("id,intake_number,status,created_at,ocr_fields").eq("id", body.id);
  if (readScope.mode === "or") readable = readable.or(readScope.predicates);
  else if (readScope.mode === "submitter") readable = readable.eq("submitted_by_profile_id", readScope.profileId);
  const { data: intake, error: readError } = await readable.maybeSingle();
  if (readError || !intake) return json({ ok: false, error: "This intake is unavailable in your permitted scope." }, 403);
  const duplicate = await loadPolicyIntakeDuplicateMatches(admin, [intake]);
  if (!duplicate.ok) return json({ ok: false, error: duplicate.error }, 503);
  if (duplicate.matches.has(body.id)) return json({ ok: false, error: "This intake is a duplicate and cannot be reviewed." }, 409);
  let query = admin.from("policy_intake_requests").update({
    status: body.status, attention_reason: reason, assigned_to_profile_id: identity.profile_id,
  }).eq("id", body.id).in("status", ["processing", "ready_for_review", "in_review", "needs_attention"]);
  if (readScope.mode === "or") query = query.or(readScope.predicates);
  else if (readScope.mode === "submitter") query = query.eq("submitted_by_profile_id", readScope.profileId);
  const { data, error } = await query.select("id").maybeSingle<{ id: string }>();
  if (error) return json({ ok: false, error: "Could not update this Policy Intake." }, 500);
  if (!data) return json({ ok: false, error: "Intake is unavailable, closed, or outside your permitted scope. Refresh and try again." }, 409);
  return json({ ok: true });
}

async function authenticate(request: Request) {
  // Prefer the HttpOnly session installed by /auth/session. An older browser-side
  // Supabase token can coexist with a valid server cookie after a password reset.
  const cookieToken = await getServerAccessToken();
  const bearer = bearerToken(request.headers.get("authorization"));
  const candidates = [...new Set([cookieToken, bearer].filter((value): value is string => Boolean(value)))];
  if (!candidates.length) return { ok: false as const, response: json({ ok: false, error: "Authentication required." }, 401) };

  let scoped: ReturnType<typeof createSupabaseWithAccessToken> | null = null;
  for (const token of candidates) {
    const candidate = createSupabaseWithAccessToken(token);
    const { data, error } = await candidate.auth.getUser(token);
    if (!error && data.user) {
      scoped = candidate;
      break;
    }
  }
  if (!scoped) return { ok: false as const, response: json({ ok: false, error: "Authentication required." }, 401) };

  const [{ data: identityData, error: identityError }, { data: scopeData, error: scopeError }] = await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_commercial_scope"),
  ]);
  if (identityError || scopeError || !identityData || !scopeData) {
    return { ok: false as const, response: json({ ok: false, error: "INSUREIT Partner access is unavailable." }, 403) };
  }

  return {
    ok: true as const,
    identity: identityData as PartnerIdentity,
    scope: scopeData as PartnerScope,
  };
}

async function prepareUpload(
  identity: PartnerIdentity,
  scope: PartnerScope,
  input: Extract<RequestBody, { action: "prepare" }>,
) {
  const mobile = cleanMobile(input.customer_mobile);
  if (mobile.length !== 10) return json({ ok: false, error: "Enter a valid 10 digit customer mobile number." }, 400);
  if (!isPolicyType(input.policy_type)) return json({ ok: false, error: "Select a valid policy type." }, 400);

  const metaError = validateMeta(input.file, input.policy_type);
  if (metaError) return json({ ok: false, error: metaError }, 400);

  const source = await resolveSource(identity, scope, input.lead_source_id);
  if (!source.ok) return json({ ok: false, error: source.error }, 403);

  const admin = createSupabaseAdminClient();
  const id = crypto.randomUUID();
  const number = intakeNumber();
  const storagePath = `intakes/${id}/original/${crypto.randomUUID()}-${safeName(input.file.name)}`;
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.signedUrl) {
    return json({ ok: false, error: "Could not prepare the policy upload. Please try again." }, 500);
  }

  return json({ ok: true, id, number, storage_path: storagePath, signed_url: data.signedUrl });
}

async function completeUpload(
  identity: PartnerIdentity,
  scope: PartnerScope,
  input: Extract<RequestBody, { action: "complete" }>,
) {
  const mobile = cleanMobile(input.customer_mobile);
  if (mobile.length !== 10) return json({ ok: false, error: "Enter a valid 10 digit customer mobile number." }, 400);
  if (!isPolicyType(input.policy_type)) return json({ ok: false, error: "Select a valid policy type." }, 400);

  const metaError = validateMeta(input.file, input.policy_type);
  if (metaError) return json({ ok: false, error: metaError }, 400);
  if (!input.id || !input.storage_path.startsWith(`intakes/${input.id}/original/`) || input.storage_path.includes("..")) {
    return json({ ok: false, error: "The upload reference is invalid." }, 400);
  }

  const sourceResult = await resolveSource(identity, scope, input.lead_source_id);
  if (!sourceResult.ok) return json({ ok: false, error: sourceResult.error }, 403);

  const admin = createSupabaseAdminClient();
  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(input.storage_path);
  if (downloadError || !blob) return json({ ok: false, error: "The policy upload did not complete." }, 400);
  if (blob.size > MAX_FILE_SIZE) {
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: `${LIFE_HEALTH_TYPES.has(input.policy_type) ? "Proposal form" : "Policy copy"} must be 15 MB or smaller.` }, 400);
  }

  const { data: customers } = await admin
    .from("customers")
    .select("id")
    .eq("phone", mobile)
    .limit(1)
    .returns<Array<{ id: string }>>();

  const source = sourceResult.source;
  const submitter = submitterColumns(identity);

  const proposalForm = LIFE_HEALTH_TYPES.has(input.policy_type);
  const { error: intakeError } = await admin.from("policy_intake_requests").insert({
    id: input.id,
    intake_number: input.number,
    status: proposalForm ? "ready_for_review" : "processing",
    policy_type: input.policy_type,
    ...submitter,
    lead_source_id: source.id,
    lead_source_type: source.intermediary_type,
    lead_source_name: source.display_name,
    lead_source_code: source.intermediary_code,
    customer_mobile: mobile,
    matched_customer_id: customers?.[0]?.id ?? null,
    storage_bucket: BUCKET,
    storage_path: input.storage_path,
    file_name: input.file.name,
    mime_type: input.file.type,
    file_size: blob.size,
    ocr_status: proposalForm ? "completed" : "pending",
    ...(proposalForm ? { ocr_fields: [], ocr_warnings: [] } : {}),
  });

  if (intakeError) {
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: "Policy intake could not be created." }, 500);
  }

  const uploader = uploaderColumns(identity);

  const { error: documentError } = await admin.from("policy_intake_documents").insert({
    intake_id: input.id,
    source_kind: "original",
    storage_bucket: BUCKET,
    storage_path: input.storage_path,
    file_name: input.file.name,
    mime_type: input.file.type,
    file_size: blob.size,
    ...uploader,
    is_current: true,
  });

  if (documentError) {
    await admin.from("policy_intake_requests").delete().eq("id", input.id);
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: "Policy intake could not be created." }, 500);
  }

  if (!proposalForm) {
    after(async () => {
      await processStoredOcr(input.id);
    });
  }

  return json({
    ok: true,
    id: input.id,
    number: input.number,
    status: proposalForm ? "ready_for_review" : "processing",
  });
}

async function submitWithoutProposal(
  identity: PartnerIdentity,
  scope: PartnerScope,
  input: Extract<RequestBody, { action: "submit_without_proposal" }>,
) {
  const mobile = cleanMobile(input.customer_mobile);
  if (mobile.length !== 10) return json({ ok: false, error: "Enter a valid 10 digit customer mobile number." }, 400);
  if (!LIFE_HEALTH_TYPES.has(input.policy_type)) {
    return json({ ok: false, error: "A proposal form can only be skipped for Life or Health policy intake." }, 400);
  }

  const sourceResult = await resolveSource(identity, scope, input.lead_source_id);
  if (!sourceResult.ok) return json({ ok: false, error: sourceResult.error }, 403);

  const admin = createSupabaseAdminClient();
  const source = sourceResult.source;
  const submitter = submitterColumns(identity);
  const id = crypto.randomUUID();
  const number = intakeNumber();

  const { error: intakeError } = await admin.from("policy_intake_requests").insert({
    id,
    intake_number: number,
    status: "ready_for_review",
    policy_type: input.policy_type,
    ...submitter,
    lead_source_id: source.id,
    lead_source_type: source.intermediary_type,
    lead_source_name: source.display_name,
    lead_source_code: source.intermediary_code,
    customer_mobile: mobile,
    matched_customer_id: null,
    storage_bucket: BUCKET,
    storage_path: "",
    file_name: "",
    mime_type: null,
    file_size: null,
    ocr_status: "completed",
    ocr_fields: [],
    ocr_warnings: [],
  });

  if (intakeError) {
    return json({ ok: false, error: "Policy intake could not be created. Please try again." }, 500);
  }

  return json({ ok: true, id, number, status: "ready_for_review" });
}

async function prepareResponse(
  identity: PartnerIdentity,
  input: Extract<RequestBody, { action: "prepare_response" }>,
) {
  const metaError = validateMeta(input.file);
  if (metaError) return json({ ok: false, error: metaError }, 400);

  const intake = await ownIntake(identity, input.id);
  if (!intake || intake.status !== "needs_attention") {
    return json({ ok: false, error: "This intake is not waiting for a replacement document." }, 403);
  }

  const storagePath = `intakes/${input.id}/responses/${crypto.randomUUID()}-${safeName(input.file.name)}`;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data?.signedUrl) {
    return json({ ok: false, error: "Could not prepare the replacement upload." }, 500);
  }

  return json({ ok: true, id: input.id, number: intake.intake_number, storage_path: storagePath, signed_url: data.signedUrl });
}

async function completeResponse(
  identity: PartnerIdentity,
  input: Extract<RequestBody, { action: "complete_response" }>,
) {
  const metaError = validateMeta(input.file);
  if (metaError) return json({ ok: false, error: metaError }, 400);
  if (!input.storage_path.startsWith(`intakes/${input.id}/responses/`) || input.storage_path.includes("..")) {
    return json({ ok: false, error: "The replacement upload reference is invalid." }, 400);
  }

  const intake = await ownIntake(identity, input.id);
  if (!intake || intake.status !== "needs_attention") {
    return json({ ok: false, error: "This intake no longer needs a response." }, 403);
  }

  const admin = createSupabaseAdminClient();
  const { data: blob, error: downloadError } = await admin.storage.from(BUCKET).download(input.storage_path);
  if (downloadError || !blob) return json({ ok: false, error: "The replacement upload did not complete." }, 400);
  const proposalForm = intake.policy_type === "life" || intake.policy_type === "health";
  if (blob.size > MAX_FILE_SIZE) {
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: `${proposalForm ? "Proposal form" : "Policy copy"} must be 15 MB or smaller.` }, 400);
  }

  const uploader = uploaderColumns(identity);

  const { data: newDocument, error: documentError } = await admin
    .from("policy_intake_documents")
    .insert({
      intake_id: input.id,
      source_kind: "replacement",
      storage_bucket: BUCKET,
      storage_path: input.storage_path,
      file_name: input.file.name,
      mime_type: input.file.type,
      file_size: blob.size,
      ...uploader,
      is_current: false,
    })
    .select("id")
    .single<{ id: string }>();

  if (documentError || !newDocument) {
    await admin.storage.from(BUCKET).remove([input.storage_path]);
    return json({ ok: false, error: "Could not attach the replacement policy copy." }, 500);
  }

  await admin.from("policy_intake_documents").update({ is_current: false }).eq("intake_id", input.id).eq("is_current", true);
  const { error: currentError } = await admin.from("policy_intake_documents").update({ is_current: true }).eq("id", newDocument.id);
  if (currentError) return json({ ok: false, error: "Could not activate the replacement policy copy." }, 500);

  let update = admin
    .from("policy_intake_requests")
    .update({
      status: proposalForm ? "ready_for_review" : "processing",
      storage_path: input.storage_path,
      file_name: input.file.name,
      mime_type: input.file.type,
      file_size: blob.size,
      ocr_status: proposalForm ? "completed" : "pending",
      ocr_fields: [],
      ocr_warnings: [],
      ocr_parser_id: null,
      ocr_parser_version: null,
      attention_reason: null,
      assigned_to_profile_id: null,
    })
    .eq("id", input.id)
    .eq("status", "needs_attention");

  const profileSubmitterId = submittedByProfileId(identity);
  update = profileSubmitterId
    ? update.eq("submitted_by_profile_id", profileSubmitterId)
    : update.eq("submitted_by_portal_account_id", legacyPortalAccountId(identity));

  const { error: updateError } = await update;
  if (updateError) return json({ ok: false, error: "Could not attach the replacement policy copy." }, 500);

  if (!proposalForm) {
    after(async () => {
      await processStoredOcr(input.id);
    });
  }

  return json({
    ok: true,
    id: input.id,
    number: intake.intake_number,
    status: proposalForm ? "ready_for_review" : "processing",
  });
}

async function ownIntake(identity: PartnerIdentity, id: string) {
  const admin = createSupabaseAdminClient();
  let query = admin
    .from("policy_intake_requests")
    .select("id,intake_number,status,policy_type,storage_bucket,storage_path")
    .eq("id", id);

  const profileSubmitterId = submittedByProfileId(identity);
  query = profileSubmitterId
    ? query.eq("submitted_by_profile_id", profileSubmitterId)
    : query.eq("submitted_by_portal_account_id", legacyPortalAccountId(identity));

  const { data } = await query.maybeSingle<{
    id: string;
    intake_number: string;
    status: string;
    policy_type: PolicyType | null;
    storage_bucket: string;
    storage_path: string;
  }>();
  return data;
}

async function resolveSource(identity: PartnerIdentity, scope: PartnerScope, requestedId?: string) {
  const authorized = await authorizedSourceIds(identity, scope);
  const requested = requestedId?.trim();
  const sourceId = isLegacyPartnerIdentity(identity)
    ? identity.intermediary_id
    : requested || (authorized.length === 1 ? authorized[0] : undefined);

  if (!sourceId) return { ok: false as const, error: "Select an authorized Partner, POSP or MISP." };
  if (!authorized.includes(sourceId)) {
    return { ok: false as const, error: "This lead source is outside your permitted sales scope." };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("intermediaries")
    .select("id,intermediary_type,display_name,intermediary_code,account_status")
    .eq("id", sourceId)
    .maybeSingle<{
      id: string;
      intermediary_type: "partner" | "posp" | "misp";
      display_name: string;
      intermediary_code: string | null;
      account_status: string;
    }>();

  if (error || !data || data.account_status !== "active" || !["partner", "posp", "misp"].includes(data.intermediary_type)) {
    return { ok: false as const, error: "The selected lead source is no longer active." };
  }

  return { ok: true as const, source: data };
}

function isExplicitPortalIdentity(identity: PartnerIdentity): identity is ExplicitPortalIdentity {
  return identity.actor_kind === "intermediary" && (identity.portal_access_type === "group" || identity.portal_access_type === "branch");
}

function isLegacyPartnerIdentity(identity: PartnerIdentity): identity is LegacyPartnerIdentity {
  return identity.actor_kind === "intermediary" && !isExplicitPortalIdentity(identity);
}

function submittedByProfileId(identity: PartnerIdentity) {
  if (identity.actor_kind === "employee") return identity.profile_id;
  if (isExplicitPortalIdentity(identity)) return identity.profile_id || identity.auth_user_id;
  // Partner Associate IDs belong to partner_portal_associate_accounts, not intermediary_portal_accounts.
  // Attribute their intakes and documents to their existing authenticated profile instead.
  if (identity.portal_account_source === "associate" && identity.profile_id && identity.profile_id === identity.auth_user_id) {
    return identity.profile_id;
  }
  return null;
}

function legacyPortalAccountId(identity: PartnerIdentity) {
  return isLegacyPartnerIdentity(identity) ? identity.portal_account_id : "00000000-0000-0000-0000-000000000000";
}

function submitterColumns(identity: PartnerIdentity) {
  const profileId = submittedByProfileId(identity);
  return profileId
    ? { submitted_by_profile_id: profileId, submitted_by_portal_account_id: null }
    : { submitted_by_profile_id: null, submitted_by_portal_account_id: legacyPortalAccountId(identity) };
}

function uploaderColumns(identity: PartnerIdentity) {
  const profileId = submittedByProfileId(identity);
  return profileId
    ? { uploaded_by_profile_id: profileId, uploaded_by_portal_account_id: null }
    : { uploaded_by_profile_id: null, uploaded_by_portal_account_id: legacyPortalAccountId(identity) };
}

async function authorizedSourceIds(identity: PartnerIdentity, scope: PartnerScope) {
  if (isLegacyPartnerIdentity(identity)) return [identity.intermediary_id];

  const ids = new Set(scope.intermediary_ids ?? []);
  // Branch portals can select their *assigned parent Partner* when the branch
  // itself has no intermediary record. Do not extend group/employee scopes or
  // expose unrelated parent accounts.
  if (!isExplicitPortalIdentity(identity) || identity.portal_access_type !== "branch") {
    return [...ids];
  }

  const scopedPartnerIds = scope.partner_ids ?? [];
  if (!scopedPartnerIds.includes(identity.portal_access_entity_id)) return [...ids];

  const admin = createSupabaseAdminClient();
  const { data: branch, error: branchError } = await admin
    .from("partners")
    .select("id,parent_partner_id,partner_status")
    .eq("id", identity.portal_access_entity_id)
    .maybeSingle<{ id: string; parent_partner_id: string | null; partner_status: string }>();
  if (branchError || branch?.partner_status !== "active_partner" || !branch.parent_partner_id) return [...ids];

  const { data: parent, error: parentError } = await admin
    .from("partners")
    .select("id,partner_status,source_application_id")
    .eq("id", branch.parent_partner_id)
    .maybeSingle<{ id: string; partner_status: string; source_application_id: string | null }>();
  if (parentError || parent?.partner_status !== "active_partner" || !parent.source_application_id) return [...ids];

  const { data: parentSource, error: sourceError } = await admin
    .from("intermediaries")
    .select("id")
    .eq("application_id", parent.source_application_id)
    .eq("intermediary_type", "partner")
    .eq("account_status", "active")
    .maybeSingle<{ id: string }>();
  if (!sourceError && parentSource) ids.add(parentSource.id);
  return [...ids];
}

async function processStoredOcr(id: string) {
  const admin = createSupabaseAdminClient();
  const { data: intake } = await admin
    .from("policy_intake_requests")
    .select("id,status,storage_bucket,storage_path,file_name,mime_type")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      status: string;
      storage_bucket: string;
      storage_path: string;
      file_name: string;
      mime_type: string | null;
    }>();

  if (!intake || intake.status !== "processing") return;

  await admin.from("policy_intake_requests")
    .update({ ocr_status: "processing" })
    .eq("id", id)
    .eq("storage_path", intake.storage_path);

  const { data: blob, error } = await admin.storage.from(intake.storage_bucket).download(intake.storage_path);
  if (error || !blob) {
    await markOcrFailure(id, intake.storage_path, "The stored policy copy could not be read automatically.");
    return;
  }

  const file = new File(
    [await blob.arrayBuffer()],
    intake.file_name,
    { type: intake.mime_type || blob.type || "application/pdf" },
  );
  const formData = new FormData();
  formData.set("policy_document", file);
  const ocr = await extractPolicyIntakeWithN8nFallback(id, intake.storage_path, file, () => extractPolicyIntakeDocumentTrusted(formData));

  if (!ocr.ok) {
    await markOcrFailure(id, intake.storage_path, ocr.error);
    return;
  }

  await admin.from("policy_intake_requests")
    .update({
      status: "ready_for_review",
      ocr_status: "completed",
      ocr_fields: ocr.fields,
      ocr_parser_id: ocr.parserId,
      ocr_parser_version: ocr.parserVersion,
      ocr_warnings: ocr.warnings,
      attention_reason: null,
    })
    .eq("id", id)
    .eq("storage_path", intake.storage_path)
    .eq("status", "processing");
}

async function markOcrFailure(id: string, storagePath: string, message: string) {
  const admin = createSupabaseAdminClient();
  await admin.from("policy_intake_requests")
    .update({ ocr_status: "failed", ocr_warnings: [message] })
    .eq("id", id)
    .eq("storage_path", storagePath)
    .eq("status", "processing");
}

function validateMeta(file: UploadMeta, policyType: PolicyType = "motor") {
  const proposalForm = LIFE_HEALTH_TYPES.has(policyType);
  const documentName = proposalForm ? "proposal form" : "policy copy";
  if (!file?.name?.trim() || !file.size) return `Upload the ${documentName} PDF or image.`;
  if (!ALLOWED_TYPES.has(file.type)) return `Upload a PDF, JPG, PNG or WebP ${documentName}.`;
  if (file.size > MAX_FILE_SIZE) return `${proposalForm ? "Proposal form" : "Policy copy"} must be 15 MB or smaller.`;
  return null;
}

function isPolicyType(value: string): value is PolicyType {
  return POLICY_TYPES.has(value);
}

function cleanMobile(value: string) {
  return String(value ?? "").replace(/\D/g, "").slice(-10);
}

function safeName(value: string) {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "policy-copy";
}

function intakeNumber() {
  return `PIR-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

function bearerToken(value: string | null) {
  if (!value) return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function json(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
