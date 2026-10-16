import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { classifyFirebaseBridgeFailure } from '../lib/customer-firebase-session-diagnostics.mjs';

test('bridge disabled is not misdiagnosed as invalid SMS OTP', () => {
  assert.equal(classifyFirebaseBridgeFailure(503, 'session_bridge_disabled'), 'bridge_disabled');
  assert.equal(classifyFirebaseBridgeFailure(503, 'session_bridge_unavailable'), 'bridge_unavailable');
});
test('missing UID approval and Auth provisioning remain separate migration gates', () => {
  assert.equal(classifyFirebaseBridgeFailure(403, 'identity_link_not_approved'), 'identity_link_missing');
  assert.equal(classifyFirebaseBridgeFailure(403, 'customer_identity_unavailable'), 'identity_link_missing');
  assert.equal(classifyFirebaseBridgeFailure(409, 'session_identity_not_provisioned'), 'auth_identity_not_ready');
});
test('replay and malicious/inconsistent codes are denied without trusting backend text', () => {
  assert.equal(classifyFirebaseBridgeFailure(429, 'too_many_attempts'), 'replay_or_rate_limit');
  assert.equal(classifyFirebaseBridgeFailure(200, 'exchange_ready'), 'unexpected_response');
  assert.equal(classifyFirebaseBridgeFailure(503, 'identity_link_not_approved'), 'unexpected_response');
  assert.equal(classifyFirebaseBridgeFailure(503, 'token=secret'), 'bridge_unavailable');
  assert.equal(classifyFirebaseBridgeFailure(999, ''), 'unexpected_response');
});
