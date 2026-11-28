type CommercialProfile = { id?: string | null; role?: string | null } | null | undefined;

// Commercial pay-in and payout data is intentionally restricted to the four
// specifically approved internal profiles plus the dedicated Accounts role.
// Capability and route guards still constrain Accounts users to accounting-only
// workspaces; keep this server-side check as a second source of truth.
const COMMERCIAL_PROFILE_IDS = new Set([
  "87e3985c-3488-401b-a3bc-5e270c74c759",
  "21a8b85f-5051-4fec-8b29-3960163b6d1f",
  "dd3a036f-2cca-4a1e-b639-21fc1cc807ef",
  "1b7cb2bb-e9a3-4713-ab42-56758dab10c9", // Ragini Gupta — Operations it_super_user
  "8c4ec4a2-d940-4394-b484-698e9ab70a69", // Nikhil Awadhwal — Operations it_super_user
  "f634d48a-e075-4dbd-849c-3e17974f3f94",
]);

export function canAccessPolicyCommercials(profile: CommercialProfile, scopedRecordAuthorized = false) {
  // Dedicated downline role must pass the per-policy/case server guard first.
  if (profile?.role === "operations_head_life") return scopedRecordAuthorized;
  if (profile?.role === "accounts") return true;
  return Boolean(profile?.id && COMMERCIAL_PROFILE_IDS.has(profile.id));
}

// Reports-only approval. Do not add this employee to the operational commercial
// allowlist above: that would also expose edit/review workflows.
const REPORT_COMMERCIAL_READ_PROFILE_IDS = new Set([
  "7bda6ffc-340e-48aa-bd3d-4f1f62cf85d9", // Gagandeep Singh — Sales Head
]);

export function canViewReportCommercials(profile: CommercialProfile) {
  // Every authenticated Super Admin can view organization-wide financial reports.
  // Keep this reports-only: it must not grant policy commercial editing access.
  if (profile?.role === "super_admin") return true;
  return canAccessPolicyCommercials(profile) || Boolean(
    profile?.id && profile.role === "sales_head" && REPORT_COMMERCIAL_READ_PROFILE_IDS.has(profile.id)
  );
}
