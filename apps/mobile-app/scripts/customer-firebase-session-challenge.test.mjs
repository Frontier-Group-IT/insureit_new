import assert from 'node:assert/strict';
import { test } from 'node:test';
import { issueExistingCustomerSessionChallenge } from '../../../supabase/functions/_shared/customer-firebase-session-challenge.mjs';

const uuid = '1e1e1e1e-1111-4111-8111-111111111111';
const other = '2e2e2e2e-2222-4222-8222-222222222222';
const email = 'existing-verified@example.org';
const hash = 'a'.repeat(64);
const gate = () => ({ ok: true, customerProfileId: uuid, verifiedExistingEmail: email });
function provider(result) {
  const calls = [];
  return {
    calls,
    db: { auth: { admin: { generateLink: async input => {
      calls.push(input);
      return result;
    } } } },
  };
}
const result = (id=uuid, newEmail=email, token=hash) => ({
  data: { user: { id, email: newEmail }, properties: { hashed_token: token } },
  error: null,
});

test('requires confirmed eligible existing Customer UUID before any privileged issuance', async () => {
  const p = provider(result());
  for (const denied of [null, undefined, {}, { ok: false }, { ok: true }, {
    ok: true, customerProfileId: uuid, verifiedExistingEmail: 'not-email',
  }, { ok: true, customerProfileId: 'not-uuid', verifiedExistingEmail: email }]) {
    assert.deepEqual(await issueExistingCustomerSessionChallenge(p.db, denied), {
      ok: false, reason: 'identity_not_eligible',
    });
  }
  assert.equal(p.calls.length, 0);
});

test('valid verified pre-existing Auth identity produces one-use Supabase challenge', async () => {
  const p = provider(result());
  assert.deepEqual(await issueExistingCustomerSessionChallenge(p.db, gate()), {
    ok: true, token_hash: hash, profile_id: uuid,
  });
  assert.deepEqual(p.calls, [{ type: 'magiclink', email }]);
});

test('wrong Auth UUID never returns someone else\'s magic-link token', async () => {
  const p = provider(result(other));
  assert.deepEqual(await issueExistingCustomerSessionChallenge(p.db, gate()), {
    ok: false, reason: 'challenge_uuid_mismatch',
  });
  assert.equal(p.calls.length, 1);
});

test('wrong email, invalid token and provider errors deny without leaking tokens', async () => {
  for (const response of [result(uuid,'other@example.org'),result(uuid,email,'bad'),
    { data: null, error: Error('test') }, { data: { user: null }, error: null }]) {
    const p = provider(response);
    const outcome = await issueExistingCustomerSessionChallenge(p.db, gate());
    assert.equal(outcome.ok, false);
    assert.ok(['challenge_uuid_mismatch', 'challenge_email_mismatch', 'challenge_hash_wrong_length', 'challenge_hash_absent', 'challenge_hash_wrong_encoding', 'challenge_provider_rejected'].includes(outcome.reason));
    assert.equal('token_hash' in outcome, false);
  }
});

test('missing provider must fail closed', async () => {
  assert.deepEqual(await issueExistingCustomerSessionChallenge({}, gate()), {
    ok: false, reason: 'challenge_provider_unavailable',
  });
});
