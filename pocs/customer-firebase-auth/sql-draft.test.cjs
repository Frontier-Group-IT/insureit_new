const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const sql = fs.readFileSync(path.join(__dirname, '20261008_identity_mapping_REVIEW_ONLY.sql'), 'utf8');

test('draft is single transaction and no SQL trails COMMIT', () => {
  assert.equal((sql.match(/\bBEGIN\s*;/g) || []).length, 1);
  assert.equal((sql.match(/\bCOMMIT\s*;/g) || []).length, 1);
  assert.match(sql.trim(), /COMMIT;$/);
  assert.equal((sql.match(/\$function\$/g) || []).length, 2);
});
test('mapping remains deny-by-default', () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON TABLE .* FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /is_approved AND link\.is_active/);
  assert.match(sql, /verified_phone_at_approval text NOT NULL/);
  assert.match(sql, /verified_phone_at_approval = claims ->> 'phone_number'/);
  assert.ok(sql.includes("verified_phone_at_approval ~ '^[+]91"));
  assert.doesNotMatch(sql, /CREATE POLICY/i);
});
test('only expected Firebase project is trusted in resolver', () => {
  assert.match(sql, /https:\/\/securetoken\.google\.com\/insureit-customer-auth/);
  assert.match(sql, /claims ->> 'aud'/);
  assert.match(sql, /firebase_project_id = 'insureit-customer-auth'/);
  assert.match(sql, /REPLACE_WITH_OWN_PROJECT/);
});
