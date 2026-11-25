// Read-only Partner Policy Intake document service.
// Migration staging: DO NOT connect the app until employee hierarchy read parity
// and authenticated role-based UAT are complete. No unsigned/public Storage URLs.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import { resolveActiveReportingProfiles } from "./intake-reporting-chain.ts";
import { partnerFamilyPredicates } from "./intake-partner-family.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Synced to web's hierarchyIntakeRoles: these roles never gain organization-wide
// Intake PDF visibility merely from having a review capability.
const hierarchyIntakeRoles = new Set(["relationship_manager","sales_manager","asm","zonal_head","sales_head","manager","director"]);
// Only complete active pages are accepted; an incomplete hierarchy must deny,
// never silently reduce or expand visibility. This is a staging-only read path.
async function activePages(admin: any, table: "employees" | "profiles", columns: string) {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 500;
  for (let start = 0; start <= 20000; start += pageSize) {
    const { data, error } = await admin.from(table).select(columns)
      .eq(table === "employees" ? "employment_status" : "is_active",
          table === "employees" ? "active" : true)
      .order("id", { ascending: true }).range(start, start + pageSize - 1);
    if (error || !Array.isArray(data)) throw new Error("Reporting-chain read unavailable");
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
  throw new Error("Reporting-chain exceeds verified page limit");
}

// Complete bounded table reads. No partial result is ever treated as an
// authoritative Partner family scope. Query builders are server-generated.
async function verifiedRows(makeQuery: (from: number, to: number) => any) {
  const rows: Record<string, any>[] = [];
  const size = 500;
  for (let from = 0; from <= 10000; from += size) {
    const { data, error } = await makeQuery(from, from + size - 1);
    if (error || !Array.isArray(data)) throw new Error("Partner family lookup unavailable");
    rows.push(...data);
    if (data.length < size) return rows;
  }
  throw new Error("Partner family lookup exceeds safe page limit");
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return json({ ok: false, error: "Authentication required." }, 401);
  let input: { id?: unknown };
  try { input = await request.json(); }
  catch { return json({ ok: false, error: "Invalid request." }, 400); }
  if (typeof input.id !== "string" || !uuid.test(input.id))
    return json({ ok: false, error: "Invalid Policy Intake reference." }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !secret)
    return json({ ok: false, error: "Policy document service unavailable." }, 503);
  const scoped = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user, error: userError } = await scoped.auth.getUser(token);
  if (userError || !user.user)
    return json({ ok: false, error: "Session expired." }, 401);
  const [{ data: identity, error: identityError }, { data: scope, error: scopeError }] = await Promise.all([
    scoped.rpc("partner_app_current_identity"),
    scoped.rpc("partner_app_commercial_scope"),
  ]);
  if (identityError || scopeError)
    return json({ ok: false, error: "Partner access temporarily unavailable." }, 503);
  if (!identity || !scope || identity.auth_user_id !== user.user.id ||
      identity.actor_kind !== scope.actor_kind ||
      !["employee", "intermediary"].includes(identity.actor_kind))
    return json({ ok: false, error: "Partner account access unavailable." }, 403);

  const admin = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // This staged endpoint supports verified organization viewers as well as
  // submitter, intermediary source and assigned in-review reviewer paths.
  // RM hierarchy and Operations Head downline remain intentionally unsupported
  // until canonical read-scope parity is proven
  // BEFORE this replaces the mobile API.
  // Never infer global read access from a capability or client-provided ID.
  let ownerField: "submitted_by_profile_id" | "submitted_by_portal_account_id";
  let ownerId: string | null = null;
  let canReadAssignedReview = false;
  let canReadOrganization = false;
  let hierarchySubmitterIds: string[] = [];
  let hierarchyFamilyPredicates: string[] = [];
  let sourceIds: string[] = [];
  if (identity.actor_kind === "employee") {
    const { data: grants, error: grantsError } = await scoped.rpc("partner_app_effective_permissions");
    if (grantsError) return json({ ok: false, error: "Intake permissions unavailable." }, 503);
    const capabilities = grants?.capabilities ?? {};
    if (!["view", "edit", "approve"].includes(capabilities.view_policy_intakes) &&
        !["edit", "approve"].includes(capabilities.review_policy_intakes) &&
        capabilities.finalize_policy_intakes !== "approve")
      return json({ ok: false, error: "Intake access unavailable." }, 403);
    if (identity.profile_id !== user.user.id)
      return json({ ok: false, error: "Account identity unavailable." }, 403);
    const { data: profile, error: profileError } = await admin.from("profiles")
      .select("id,role,is_active").eq("id", identity.profile_id).maybeSingle();
    if (profileError) return json({ ok: false, error: "Employee profile temporarily unavailable." }, 503);
    if (!profile || profile.is_active !== true)
      return json({ ok: false, error: "Employee account unavailable." }, 403);
    ownerField = "submitted_by_profile_id";
    ownerId = identity.profile_id;
    canReadAssignedReview = ["edit", "approve"].includes(capabilities.review_policy_intakes) ||
      capabilities.finalize_policy_intakes === "approve";
    // Canonical website policy: an active super_admin is organization-scoped
    // after effective view authorization. Other non-hierarchy reviewers need
    // explicit edit permission; approve-only does not imply organization read.
    // Life Operations Heads and RM hierarchy roles keep their narrower scope.
    const constrainedRole = profile.role === "operations_head_life" ||
      hierarchyIntakeRoles.has(profile.role ?? "");
    canReadOrganization = !constrainedRole &&
      (profile.role === "super_admin" ||
       ["edit", "approve"].includes(capabilities.review_policy_intakes));
    // Migrate only the verified active-employee/submitter portion of
    // reportingChainScope. The RM role uses capability-specific overrides;
    // Partner/Branch family source predicates are not migrated here.
    if (hierarchyIntakeRoles.has(profile.role ?? "") && profile.role !== "relationship_manager") {
      const { data: owner, error: ownerError } = await admin.from("profiles")
        .select("employee_id").eq("id", identity.profile_id).eq("is_active", true).maybeSingle();
      if (ownerError) return json({ ok: false, error: "Reporting-chain owner unavailable." }, 503);
      if (owner?.employee_id) {
        try {
          const [employees, profiles] = await Promise.all([
            activePages(admin, "employees", "id,reporting_manager_id"),
            activePages(admin, "profiles", "id,employee_id"),
          ]);
          const resolved = resolveActiveReportingProfiles(
            owner.employee_id, identity.profile_id,
            employees as Array<{ id: string; reporting_manager_id: string | null }>,
            profiles as Array<{ id: string; employee_id: string | null }>,
          );
          hierarchySubmitterIds = resolved.profileIds;
          // Canonical rm-policy-intake-scope: descendants' onboarding
          // applications -> parent Partners -> branches -> verified linked
          // login profiles/intermediaries/portal accounts. Never infer this
          // access from a name, customer record, or client-supplied code.
          if (resolved.employeeIds.length) {
            const onboarding = await verifiedRows((from,to) =>
              admin.from("posp_misp_onboarding_profiles")
                .select("application_id")
                .in("associate_employee_id", resolved.employeeIds)
                .order("application_id", { ascending: true }).range(from,to));
            const applications = [...new Set(onboarding.map(x=>x.application_id).filter(Boolean))];
            if (applications.length) {
              const parents = await verifiedRows((from,to) =>
                admin.from("partners").select("id,partner_code")
                  .in("source_application_id", applications)
                  .is("parent_partner_id", null)
                  .order("id", { ascending: true }).range(from,to));
              if (parents.length) {
                const branches = await verifiedRows((from,to) =>
                  admin.from("partners").select("id,partner_code")
                    .in("parent_partner_id", parents.map(x=>x.id))
                    .order("id", { ascending: true }).range(from,to));
                const family = [...parents,...branches];
                const familyCodes = [...new Set(family.map(x=>x.partner_code?.trim()).filter(Boolean))];
                const identities = await verifiedRows((from,to) =>
                  admin.from("portal_access_identities").select("profile_id")
                    .in("entity_id", family.map(x=>x.id))
                    .in("entity_type", ["partner","branch"])
                    .order("profile_id", { ascending: true }).range(from,to));
                const intermediaries = familyCodes.length
                  ? await verifiedRows((from,to) =>
                    admin.from("intermediaries").select("id")
                      .in("intermediary_code",familyCodes)
                      .order("id", { ascending: true }).range(from,to))
                  : [];
                const accounts = intermediaries.length
                  ? await verifiedRows((from,to) =>
                    admin.from("intermediary_portal_accounts").select("id")
                      .in("intermediary_id", intermediaries.map(x=>x.id))
                      .order("id", { ascending: true }).range(from,to))
                  : [];
                hierarchyFamilyPredicates = partnerFamilyPredicates(
                  parents,branches,identities,intermediaries,accounts);
              }
            }
          }
        } catch {
          return json({ ok: false, error: "Reporting-chain scope unavailable." }, 503);
        }
      }
    }
  } else {
    // Match the canonical website document route: ordinary intermediary
    // accounts see their own lead source, while branch/group accounts use
    // only intermediary IDs from the authenticated commercial-scope RPC.
    // Validate identifiers before placing them in PostgREST OR predicates.
    const scopedIds = identity.portal_access_type
      ? (scope.intermediary_ids ?? [])
      : [identity.intermediary_id].filter((id: unknown) => id !== null && id !== undefined);
    if (!Array.isArray(scopedIds) || scopedIds.some((id: unknown) =>
      typeof id !== "string" || !uuid.test(id)))
      return json({ ok: false, error: "Lead-source scope unavailable." }, 503);
    sourceIds = [...new Set(scopedIds)];
    if (identity.portal_access_type === "branch" || identity.portal_access_type === "group") {
      ownerField = "submitted_by_profile_id";
      ownerId = identity.profile_id || identity.auth_user_id || null;
    } else if (identity.portal_account_source === "associate" &&
               identity.profile_id === identity.auth_user_id) {
      ownerField = "submitted_by_profile_id";
      ownerId = identity.profile_id;
    } else {
      ownerField = "submitted_by_portal_account_id";
      ownerId = identity.portal_account_id || null;
    }
  }
  // Identity and scope values must be server-verified UUIDs before they are
  // interpolated into a PostgREST expression. The client controls only id.
  if (ownerId && !uuid.test(ownerId))
    return json({ ok: false, error: "Partner identity unavailable." }, 403);
  const predicates: string[] = [];
  if (ownerId) predicates.push(`${ownerField}.eq.${ownerId}`);
  if (identity.actor_kind === "employee" && canReadAssignedReview && ownerId) {
    predicates.push(`and(assigned_to_profile_id.eq.${ownerId},status.eq.in_review)`);
  }
  if (identity.actor_kind === "employee" && hierarchySubmitterIds.length) {
    predicates.push(`submitted_by_profile_id.in.(${hierarchySubmitterIds.join(",")})`);
  }
  if (identity.actor_kind === "employee" && hierarchyFamilyPredicates.length) {
    predicates.push(...hierarchyFamilyPredicates);
  }
  if (identity.actor_kind === "intermediary" && sourceIds.length) {
    predicates.push(`lead_source_id.in.(${sourceIds.join(",")})`);
  }
  if (!canReadOrganization && !predicates.length)
    return json({ ok: false, error: "Partner access unavailable." }, 403);
  let intakeQuery = admin.from("policy_intake_requests")
    .select("storage_bucket,storage_path").eq("id", input.id);
  // Organization access is explicit, never produced by a client-provided filter.
  if (!canReadOrganization) intakeQuery = intakeQuery.or(predicates.join(","));
  const { data: intake, error: intakeError } = await intakeQuery.maybeSingle();
  if (intakeError) return json({ ok: false, error: "Policy document lookup unavailable." }, 503);
  if (!intake) return json({ ok: false, error: "Policy Intake not available to this account." }, 404);
  if (typeof intake.storage_bucket !== "string" || !intake.storage_bucket ||
      typeof intake.storage_path !== "string" || !intake.storage_path)
    return json({ ok: false, error: "Policy copy unavailable." }, 404);
  const { data: signed, error: signedError } = await admin.storage
    .from(intake.storage_bucket).createSignedUrl(intake.storage_path, 300);
  if (signedError || !signed?.signedUrl)
    return json({ ok: false, error: "Could not open policy copy." }, 503);
  return json({ ok: true, url: signed.signedUrl });
});
