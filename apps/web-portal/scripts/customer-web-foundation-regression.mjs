import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error("Customer Web foundation regression failed: " + message);
    process.exitCode = 1;
  }
}

const requiredFiles = [
  "lib/customer-web.ts",
  "app/api/customer/auth/session/route.ts",
  "app/customer/login/customer-login-form.tsx",
  "app/customer/login/page.tsx",
  "app/customer/(protected)/layout.tsx",
  "app/customer/(protected)/page.tsx",
  "app/customer/(protected)/home/page.tsx",
  "components/customer-portal/customer-navigation.tsx",
  "components/customer-portal/customer-phase1.tsx",
  "lib/customer-web-data.ts",
  "app/customer/(protected)/vehicles/page.tsx",
  "app/customer/(protected)/vehicles/[id]/page.tsx",
  "app/customer/(protected)/policies/page.tsx",
  "app/customer/(protected)/policies/[id]/page.tsx",
  "lib/customer-web-phase2-data.ts",
  "app/customer/(protected)/renewals/page.tsx",
  "app/customer/(protected)/claims/page.tsx",
  "app/customer/(protected)/claims/[id]/page.tsx",
  "lib/customer-web-phase3-data.ts",
  "components/customer-portal/customer-service-request-form.tsx",
  "app/customer/services/enquiry/route.ts",
  "app/customer/(protected)/exchange/page.tsx",
  "app/customer/(protected)/exchange/[listingId]/page.tsx",
  "app/customer/(protected)/insurance-quote/page.tsx",
  "app/customer/(protected)/e-challan/page.tsx",
  "app/customer/(protected)/support/page.tsx",
  "app/customer/(protected)/support/[id]/page.tsx",
  "lib/customer-web-phase4-data.ts",
  "components/customer-portal/customer-profile-editor.tsx",
  "components/customer-portal/customer-document-vault.tsx",
  "components/customer-portal/customer-kyc-form.tsx",
  "app/customer/profile/update/route.ts",
  "app/api/customer/documents/route.ts",
  "app/api/customer/documents/open/route.ts",
  "app/customer/kyc/start/route.ts",
  "app/customer/kyc/locations/route.ts",
  "app/customer/kyc/documents/route.ts",
  "app/customer/kyc/submit/route.ts",
  "app/customer/(protected)/profile/page.tsx",
  "app/customer/(protected)/documents/page.tsx",
  "app/customer/(protected)/kyc/page.tsx",
];

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), "missing Customer Web foundation file: " + file);
}

const guard = read("lib/customer-web.ts");
assert(guard.includes('profile.role !== "customer"'), "Customer Web guard must explicitly require the customer role");
assert(guard.includes('redirect("/customer/login")'), "missing Customer Web session must return to Customer Login");
assert(guard.includes('from("customer_memberships")'), "Customer Web scope must resolve active customer memberships");
assert(guard.includes('.eq("status", "active")'), "Customer Web memberships must be active");
assert(!guard.includes("@/lib/partner-web"), "Customer Web must not depend on Partner authorization");
assert(!guard.includes("supabase-admin"), "Customer Web must not use service-role/admin helpers");

const sessionRoute = read("app/api/customer/auth/session/route.ts");
assert(sessionRoute.includes('profile.role !== "customer"'), "Customer Web session endpoint must reject non-customer roles");
assert(sessionRoute.includes('sessionRoleCookie, "customer"'), "Customer Web session must record only the customer role");
assert(sessionRoute.includes("supabase.auth.getUser(accessToken)"), "Customer Web session must verify the access token server-side through Supabase Auth");
assert(sessionRoute.includes('from("profiles")'), "Customer Web session must verify the authenticated customer profile server-side");
assert(!sessionRoute.includes("getAuthenticatedProfile"), "Customer Web Cloudflare session path must not depend on the shared getClaims-based auth helper");
assert(!sessionRoute.includes("@/lib/partner-web"), "Customer Web session must remain independent from Partner authorization");
assert(!sessionRoute.includes("isAuthorizedProfile"), "Customer Web session must not widen employee/Partner authorization");
assert(!sessionRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Customer Web session must not use service-role credentials");

const login = read("app/customer/login/customer-login-form.tsx");
assert(login.includes("shouldCreateUser: false"), "Customer login must not silently create accounts");
assert(login.includes('profile.role !== "customer"'), "Customer login must verify customer role before creating browser session");
assert(login.includes('fetch("/api/customer/auth/session"'), "Customer login must use the isolated Customer Web session API endpoint");
assert(!login.includes('fetch("/auth/session"'), "Customer login must not use the employee/Partner session endpoint");
assert(login.includes("customerSessionErrorMessage"), "Customer login must surface safe Customer-only session diagnostics");

const protectedLayout = read("app/customer/(protected)/layout.tsx");
assert(protectedLayout.includes("await getCustomerWebSession()"), "protected Customer layout must authenticate server-side");

const phaseOneData = read("lib/customer-web-data.ts");
assert(phaseOneData.includes("await getCustomerWebSession()"), "Customer Phase 1 data scope must derive from authenticated Customer Web session");
assert(phaseOneData.includes('.eq("customer_id", customerId)'), "Customer Phase 1 queries must remain customer-id scoped");
assert(phaseOneData.includes('from("external_policies")'), "Customer Policies must include external policy parity");
assert(phaseOneData.includes("currentCustomerPolicies"), "Customer Policies must retain current-policy deduplication");
assert(!phaseOneData.includes("createSupabaseAdminClient"), "Customer Phase 1 must not use admin/service-role data access");
assert(!phaseOneData.includes("@/lib/partner-web"), "Customer Phase 1 must not depend on Partner authorization");

const vehiclePage = read("app/customer/(protected)/vehicles/page.tsx");
const vehicleDetailPage = read("app/customer/(protected)/vehicles/[id]/page.tsx");
const policyPage = read("app/customer/(protected)/policies/page.tsx");
const policyDetailPage = read("app/customer/(protected)/policies/[id]/page.tsx");
assert(vehiclePage.includes("resolveCustomerWebScope"), "Customer Vehicles must resolve authorized Customer account scope");
assert(vehicleDetailPage.includes("loadCustomerVehicleDetail(account.id, id)"), "Vehicle Detail must validate the requested vehicle inside Customer scope");
assert(policyPage.includes("resolveCustomerWebScope"), "Customer Policies must resolve authorized Customer account scope");
assert(policyDetailPage.includes("loadCustomerPolicyDetail(account.id, id"), "Policy Detail must validate the requested policy inside Customer scope");
assert(vehicleDetailPage.includes('pathname="/customer/vehicles"'), "Vehicle Detail account switching must return to the scoped Vehicles list");
assert(policyDetailPage.includes('pathname="/customer/policies"'), "Policy Detail account switching must return to the scoped Policies list");


const phaseTwoData = read("lib/customer-web-phase2-data.ts");
const renewalsPage = read("app/customer/(protected)/renewals/page.tsx");
const claimsPage = read("app/customer/(protected)/claims/page.tsx");
const claimDetailPage = read("app/customer/(protected)/claims/[id]/page.tsx");
assert(phaseTwoData.includes("CUSTOMER_RENEWAL_DUE_WINDOW_DAYS = 45"), "Customer Renewals must preserve the 45-day Customer App due window");
assert(phaseTwoData.includes('from("claims").select("*").eq("customer_id", customerId)'), "Customer Claims must remain customer-id scoped");
assert(phaseTwoData.includes('from("claim_milestones")'), "Customer Claims must include claim milestone tracking");
assert(phaseTwoData.includes("projectInternalClaim"), "Customer internal claim journeys must use the shared claim projection");
assert(!phaseTwoData.includes("createSupabaseAdminClient"), "Customer Phase 2 must not use admin/service-role data access");
assert(!phaseTwoData.includes("@/lib/partner-web"), "Customer Phase 2 must not depend on Partner authorization");
assert(!phaseTwoData.includes(".insert("), "Customer Phase 2 data layer must remain read-only");
assert(!phaseTwoData.includes(".update("), "Customer Phase 2 data layer must remain read-only");
assert(!phaseTwoData.includes(".delete("), "Customer Phase 2 data layer must remain read-only");
assert(renewalsPage.includes("resolveCustomerWebScope"), "Customer Renewals must resolve authorized Customer account scope");
assert(claimsPage.includes("resolveCustomerWebScope"), "Customer Claims must resolve authorized Customer account scope");
assert(claimDetailPage.includes("loadCustomerClaimDetail(account.id, id)"), "Claim Detail must validate the requested claim inside Customer scope");
const claimStagePage = read("app/customer/(protected)/claims/[id]/stage/[stage]/page.tsx");
assert(claimDetailPage.includes("loadCustomerClaimDetail(account.id, id)"), "Claim Detail redirect must validate the requested claim within Customer scope");
assert(claimDetailPage.includes("stage/spot_intimation"), "Claim Detail must open the canonical first stage");
assert(claimStagePage.includes("@insureit/claim-journey"), "Claim Stage must render the shared internal claim journey");
assert(claimStagePage.includes("loadCustomerClaimDetail(account.id,p.id)"), "Claim Stage must validate the requested claim within Customer scope");
assert(!claimsPage.includes("supabase."), "Customer Claims page must use the scoped Customer data layer rather than direct client queries");
assert(!claimDetailPage.includes("supabase."), "Customer Claim Detail must use the scoped Customer data layer rather than direct client queries");


const phaseThreeData = read("lib/customer-web-phase3-data.ts");
const phaseThreeForm = read("components/customer-portal/customer-service-request-form.tsx");
const phaseThreeServiceRoute = read("app/customer/services/enquiry/route.ts");
const exchangePage = read("app/customer/(protected)/exchange/page.tsx");
const exchangeDetailPage = read("app/customer/(protected)/exchange/[listingId]/page.tsx");
const quotePage = read("app/customer/(protected)/insurance-quote/page.tsx");
const challanPage = read("app/customer/(protected)/e-challan/page.tsx");
const supportPage = read("app/customer/(protected)/support/page.tsx");
const supportDetailPage = read("app/customer/(protected)/support/[id]/page.tsx");

assert(phaseThreeData.includes('exchange_marketplace_feed'), "Customer Phase 3 Exchange must use the canonical marketplace feed RPC");
assert(phaseThreeData.includes('exchange_listing_detail'), "Customer Phase 3 Exchange detail must use the canonical listing detail RPC");
assert(phaseThreeData.includes('.eq("customer_id", customerId)'), "Customer Phase 3 support activity must remain customer-id scoped");
assert(!phaseThreeData.includes("createSupabaseAdminClient"), "Customer Phase 3 must not use admin/service-role data access");
assert(!phaseThreeData.includes("@/lib/partner-web"), "Customer Phase 3 must not depend on Partner authorization");
assert(!phaseThreeData.includes("exchange_place_bid"), "Customer Web Phase 3 Exchange must remain browse-only");
assert(!phaseThreeData.includes("exchange_upsert_listing_draft"), "Customer Web Phase 3 Exchange must not expose seller writes");
assert(!phaseThreeData.includes("exchange_toggle_favorite"), "Customer Web Phase 3 Exchange must not expose favorite writes");
assert(phaseThreeServiceRoute.includes("await getCustomerWebSession()"), "Customer service writes must require the authenticated Customer Web session");
assert(phaseThreeServiceRoute.includes("session.accounts.some"), "Customer service writes must verify the requested Customer account belongs to the session");
assert(phaseThreeServiceRoute.includes('.eq("customer_id", customerId)'), "Customer service route must scope referenced vehicles/claims to the authorized Customer");
assert(
  phaseThreeServiceRoute.includes('"service_enquiries"') && phaseThreeServiceRoute.includes(".insert("),
  "Customer Phase 3 services must use the unified service_enquiries workflow",
);
assert(!phaseThreeServiceRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Customer Phase 3 service writes must not use service-role credentials");
assert(!phaseThreeServiceRoute.includes("@/lib/partner-web"), "Customer Phase 3 service writes must remain independent from Partner authorization");
assert(phaseThreeForm.includes('fetch("/customer/services/enquiry"'), "Customer Phase 3 forms must use the isolated Customer service endpoint");
assert(exchangePage.includes("resolveCustomerWebScope"), "Customer Exchange must resolve authorized Customer scope");
assert(exchangeDetailPage.includes("loadCustomerExchangeListing"), "Customer Exchange detail must use the Phase 3 scoped data layer");
assert(quotePage.includes("resolveCustomerWebScope"), "Customer Insurance Quote must resolve authorized Customer scope");
assert(challanPage.includes("resolveCustomerWebScope"), "Customer E-Challan must resolve authorized Customer scope");
assert(supportPage.includes("resolveCustomerWebScope"), "Customer Support must resolve authorized Customer scope");
assert(supportDetailPage.includes("loadCustomerServiceActivityDetail(account.id, id)"), "Customer Support detail must validate the request inside Customer scope");

const phaseFourData = read("lib/customer-web-phase4-data.ts");
const profileUpdateRoute = read("app/customer/profile/update/route.ts");
const documentRoute = read("app/api/customer/documents/route.ts");
const documentOpenRoute = read("app/api/customer/documents/open/route.ts");
const kycStartRoute = read("app/customer/kyc/start/route.ts");
const kycLocationRoute = read("app/customer/kyc/locations/route.ts");
const kycDocumentRoute = read("app/customer/kyc/documents/route.ts");
const kycSubmitRoute = read("app/customer/kyc/submit/route.ts");
const profilePage = read("app/customer/(protected)/profile/page.tsx");
const documentsPage = read("app/customer/(protected)/documents/page.tsx");
const kycPage = read("app/customer/(protected)/kyc/page.tsx");
const kycForm = read("components/customer-portal/customer-kyc-form.tsx");

assert(phaseFourData.includes("await getCustomerWebSession()"), "Customer Phase 4 profile data must require the Customer Web session");
assert(phaseFourData.includes('from("customer_documents")'), "Customer Phase 4 must use the existing Customer document vault");
assert(phaseFourData.includes('from("customer_onboarding_applications")'), "Customer Phase 4 must use the existing onboarding application");
assert(!phaseFourData.includes("createSupabaseAdminClient"), "Customer Phase 4 must not use admin/service-role data access");
assert(!phaseFourData.includes("@/lib/partner-web"), "Customer Phase 4 must remain independent from Partner authorization");
assert(profileUpdateRoute.includes("session.accounts.some"), "Customer profile writes must validate authorized Customer account ownership");
assert(profileUpdateRoute.includes('.eq("id", customerId)'), "Customer profile writes must target only the selected Customer account");
assert(!profileUpdateRoute.includes("SUPABASE_SERVICE_ROLE_KEY"), "Customer profile writes must not use service-role credentials");
assert(documentRoute.includes("MAX_FILE_SIZE = 5 * 1024 * 1024"), "Customer document uploads must keep the 5 MB limit");
assert(documentRoute.includes("session.accounts.some"), "Customer document writes must validate authorized Customer account ownership");
assert(documentRoute.includes('.eq("customer_id", customerId)'), "Customer document deletion must remain customer-id scoped");
assert(documentOpenRoute.includes("resolveCustomerWebScope(customerId)"), "Customer document open route must validate Customer account scope");
assert(kycStartRoute.includes("await getCustomerWebSession()"), "Customer KYC start must require Customer session");
assert(kycStartRoute.includes('partner_type: "individual_proprietor"'), "Customer Web KYC must preserve the app's Individual KYC route");
assert(kycLocationRoute.includes("await getCustomerWebSession()"), "Customer KYC PIN lookup must require Customer session");
assert(kycDocumentRoute.includes('.eq("profile_id", session.user.id)'), "KYC document writes must verify application ownership");
assert(kycDocumentRoute.includes("MAX_FILE_SIZE = 5 * 1024 * 1024"), "KYC documents must keep the Customer App 5 MB limit");
assert(kycSubmitRoute.includes('.eq("profile_id", session.user.id)'), "KYC submission must verify application ownership");
assert(kycSubmitRoute.includes('submit_individual_onboarding_application'), "Customer Web must use the canonical Individual KYC submission RPC");
const kycDraftBlock = kycSubmitRoute.slice(
  kycSubmitRoute.indexOf("const draftData = {"),
  kycSubmitRoute.indexOf("const draft = await supabase"),
);
assert(!kycDraftBlock.toLowerCase().includes("aadhaar"), "Customer Web KYC draft must not persist raw Aadhaar");
assert(kycSubmitRoute.includes("p_aadhaar_number: aadhaarNumber"), "Customer Web KYC must pass Aadhaar only to the canonical submission RPC");
assert(kycForm.includes('type="password"'), "Customer Web KYC must mask Aadhaar entry");
assert(profilePage.includes("loadCustomerProfile(account.id)"), "Customer Profile page must remain selected-account scoped");
assert(documentsPage.includes("loadCustomerProfile(account.id)"), "Customer Documents page must remain selected-account scoped");
assert(kycPage.includes("loadCustomerProfile(account.id)"), "Customer KYC page must remain selected-account scoped");

const navigation = read("components/customer-portal/customer-navigation.tsx");
const customerSettings = read("app/customer/(protected)/settings/page.tsx");
assert(navigation.includes('href="/customer/settings"'), "Customer sidebar must offer Settings instead of direct sign out");
assert(customerSettings.includes('fetch("/api/customer/auth/session", { method: "DELETE" })'), "Customer logout in Settings must clear the isolated session API endpoint");
assert(customerSettings.includes("supabase.auth.signOut()"), "Customer logout in Settings must terminate Supabase Auth session");
assert(!navigation.includes('href="/partner'), "Customer navigation must not expose Partner routes");
assert(!navigation.includes('href="/reports'), "Customer navigation must not expose Operations report routes");
assert(navigation.includes('href="/customer/vehicles"'), "Customer navigation must expose Phase 1 Vehicles");
assert(navigation.includes('href="/customer/policies"'), "Customer navigation must expose Phase 1 Policies");
assert(navigation.includes('href="/customer/renewals"'), "Customer navigation must expose Phase 2 Renewals");
assert(navigation.includes('href="/customer/claims"'), "Customer navigation must expose Phase 2 Claims");
assert(navigation.includes('href="/customer/exchange"'), "Customer navigation must expose Phase 3 Exchange");
assert(navigation.includes('href="/customer/insurance-quote"'), "Customer navigation must expose Phase 3 Insurance Quote");
assert(navigation.includes('href="/customer/e-challan"'), "Customer navigation must expose Phase 3 E-Challan");
assert(navigation.includes('href="/customer/support"'), "Customer navigation must expose Phase 3 Support");
assert(navigation.includes('href="/customer/profile"'), "Customer navigation must expose Phase 4 Profile");
assert(navigation.includes('href="/customer/kyc"'), "Customer navigation must expose Phase 4 KYC");
assert(navigation.includes('href="/customer/documents"'), "Customer navigation must expose Phase 4 Documents");

const portalRoutes = read("lib/portal-routes.ts");
const middleware = read("middleware.ts");
assert(portalRoutes.includes('"/customer"'), "Customer Web must participate in protected route session coverage");
assert(middleware.includes('type SessionStatus = "authorized" | "customer" | "forbidden" | "invalid"'), "Customer sessions must remain distinct from employee/Partner authorization");
assert(middleware.includes('profile?.is_active && profile.role === "customer"'), "middleware must recognize only active customer profiles");
assert(middleware.includes('if (check.status !== "customer")'), "Customer routes must reject non-customer sessions");
assert(middleware.includes('if (check.status === "customer") return redirect(request, "/access-denied"'), "Customer sessions must remain denied from existing protected employee/Partner routes");
assert(middleware.includes('"/customer/:path*"'), "Customer Web must remain inside middleware session-refresh coverage");
assert(middleware.includes('pathname === "/customer/auth/session"'), "Customer session bootstrap must have an exact-path middleware bypass");
assert(
  middleware.indexOf('pathname === "/customer/auth/session"') < middleware.indexOf("if (isCustomerPortalPath(pathname))"),
  "Customer session bootstrap bypass must run before protected Customer route enforcement",
);

const partnerGuard = read("lib/partner-web.ts");
assert(partnerGuard.includes('profile.role !== "intermediary"'), "Partner authorization must remain intermediary-only");

const sharedAuthConfig = read("lib/auth-config.ts");
assert(!sharedAuthConfig.includes('allowedAdminRoles = ["customer"'), "Customer must not be added to employee admin roles");
assert(sharedAuthConfig.includes('role!==\"customer\"') || read("lib/roles.ts").includes('role!=="customer"'), "Customer must remain excluded from employee portal roles");

if (!process.exitCode) {
  console.log("Customer Web foundation regression passed.");
}