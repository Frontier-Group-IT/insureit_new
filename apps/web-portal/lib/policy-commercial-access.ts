type CommercialProfile = { id?: string | null; role?: string | null } | null | undefined;

// Commercial pay-in and payout data is intentionally restricted to the four
// specifically approved internal profiles plus the dedicated Accounts role.
// Capability and route guards still constrain Accounts users to accounting-only
// workspaces; keep this server-side check as a second source of truth.
const COMMERCIAL_PROFILE_IDS = new Set([
  "87e3985c-3488-401b-a3bc-5e270c74c759",
  "21a8b85f-5051-4fec-8b29-3960163b6d1f",
  "dd3a036f-2cca-4a1e-b639-21fc1cc807ef",
  "f634d48a-e075-4dbd-849c-3e17974f3f94",
]);

export function canAccessPolicyCommercials(profile: CommercialProfile) {
  if (profile?.role === "accounts") return true;
  return Boolean(profile?.id && COMMERCIAL_PROFILE_IDS.has(profile.id));
}
