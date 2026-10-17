/** Safe, bounded telemetry for the Firebase -> Supabase login handoff.
 * Never include JWTs, OTPs, phone numbers, Firebase UIDs, Auth UUIDs or URLs.
 * A 503 means the bridge is unavailable/disabled; it is NOT an invalid SMS OTP.
 */
export const BRIDGE_FAILURES = Object.freeze({
  session_bridge_disabled: 'bridge_disabled',
  session_bridge_unavailable: 'bridge_unavailable',
  customer_identity_unavailable: 'identity_link_missing',
  identity_link_not_approved: 'identity_link_missing',
  session_identity_not_provisioned: 'auth_identity_not_ready',
  too_many_attempts: 'replay_or_rate_limit',
  invalid_phone_identity: 'verified_identity_invalid',
});
export function classifyFirebaseBridgeFailure(status, code) {
  if (!Number.isInteger(status) || status < 400 || status > 599) return 'unexpected_response';
  if (typeof code === 'string' && Object.hasOwn(BRIDGE_FAILURES, code)) {
    const expected = {
      bridge_disabled: 503, bridge_unavailable: 503,
      identity_link_missing: 403, auth_identity_not_ready: 409,
      replay_or_rate_limit: 429, verified_identity_invalid: 401,
    };
    const category = BRIDGE_FAILURES[code];
    return expected[category] === status ? category : 'unexpected_response';
  }
  if (status === 503) return 'bridge_unavailable';
  if (status === 403) return 'identity_check_failed';
  if (status === 409) return 'auth_identity_not_ready';
  if (status === 429) return 'replay_or_rate_limit';
  if (status === 401) return 'verified_identity_invalid';
  return 'unexpected_response';
}
