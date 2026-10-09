/**
 * Firebase Customer OTP migration adapter (feature-gated).
 *
 * Current production remains on Supabase SMS OTP until the native Firebase
 * runtime, third-party Auth configuration, and identity-aware RLS migration are
 * jointly enabled. Do NOT use a Firebase UID as a Supabase profile UUID.
 *
 * This module intentionally has no native Firebase imports so it can ship
 * safely in today's Expo binary without causing an incompatible OTA.
 */
export type FirebaseOtpState =
  | { status: 'not_configured'; reason: string }
  | { status: 'ready_for_native_build' };

export type FirebaseOtpConfig = Readonly<{
  provider: 'firebase';
  projectId: 'insureit-customer-auth';
  requiresNativeBuild: true;
  requiresThirdPartyAuth: true;
  requiresIdentityMapping: true;
}>;

export const firebaseOtpConfig: FirebaseOtpConfig = {
  provider: 'firebase',
  projectId: 'insureit-customer-auth',
  requiresNativeBuild: true,
  requiresThirdPartyAuth: true,
  requiresIdentityMapping: true,
};

/** Explicit, deny-by-default release gate; never infer readiness from env keys. */
export function getFirebaseOtpReadiness(input: {
  nativeModuleInstalled: boolean;
  firebaseAndroidAppRegistered: boolean;
  supabaseThirdPartyConfigured: boolean;
  reviewedIdentityMappingEnabled: boolean;
  rlsVerified: boolean;
}): FirebaseOtpState {
  if (!input.nativeModuleInstalled) return { status: 'not_configured', reason: 'Native Firebase authentication runtime is unavailable.' };
  if (!input.firebaseAndroidAppRegistered) return { status: 'not_configured', reason: 'Firebase Android app verification is not configured.' };
  if (!input.supabaseThirdPartyConfigured) return { status: 'not_configured', reason: 'Supabase Firebase third-party authentication is not enabled.' };
  if (!input.reviewedIdentityMappingEnabled) return { status: 'not_configured', reason: 'Identity mapping has not been enabled.' };
  if (!input.rlsVerified) return { status: 'not_configured', reason: 'Customer authorization has not been verified.' };
  return { status: 'ready_for_native_build' };
}
