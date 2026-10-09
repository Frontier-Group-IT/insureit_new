const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../../supabase/functions/customer-firebase-doc-read/index.ts'),'utf8');

test('signed document reads verify Firebase token including revocation',()=>{
  assert.match(source,/verifyIdToken\(bearer\[1\], true\)/);
  assert.match(source,/decoded\.aud !== PROJECT/);
  assert.match(source,/decoded\.iss !== ISSUER/);
  assert.match(source,/decoded\.firebase\?\.sign_in_provider !== "phone"/);
  assert.match(source,/decoded\.role !== "authenticated"/);
  assert.ok(source.indexOf('verifyIdToken(bearer[1], true)') < source.indexOf('createClient(url, key'));
});
test('approved mapping and unchanged active customer profile are required',()=>{
  assert.match(source,/\.eq\("firebase_project_id", PROJECT\)\.eq\("firebase_uid", decoded\.uid\)/);
  assert.match(source,/links\.length !== 1/);
  assert.match(source,/!links\[0\]\.is_approved \|\| !links\[0\]\.is_active/);
  assert.match(source,/links\[0\]\.verified_phone_at_approval !== decoded\.phone_number/);
  assert.match(source,/!profile\.is_active \|\| profile\.role !== "customer"/);
  assert.match(source,/CANONICAL\(profile\.phone\) !== decoded\.phone_number/);
});
test('private document access must check registered path plus ownership or membership',()=>{
  assert.match(source,/\["claim-documents", "customer-documents"\]/);
  assert.match(source,/\.eq\("storage_bucket", bucket\)\.eq\("storage_path", documentPath\)/);
  assert.match(source,/claim\?\.customer_id === d\.customer_id/);
  assert.match(source,/customer\.profile_id === profileId/);
  assert.match(source,/\.eq\("status", "active"\)/);
  assert.match(source,/application\?\.profile_id === profileId && application\.source === "customer_app"/);
  assert.match(source,/if \(!allowed\) return reply\(404/);
});
test('gateway cannot mutate data or expose long-lived or unbounded storage access',()=>{
  assert.match(source,/bytes > 2048/);
  assert.match(source,/Object\.keys\(input\)\.some\(\(field\) => !\["bucket", "path"\]\.includes\(field\)\)/);
  assert.match(source,/createSignedUrl\(documentPath, 60\)/);
  assert.match(source,/expiresIn: 60/);
  assert.doesNotMatch(source,/\.remove\(|\.upload\(|\.update\(|\.insert\(|\.delete\(/);
});

test('policy document owner matches canonical customer or active membership',()=>{
  assert.match(source,/bucket === "policy-documents"/);
  assert.match(source,/from\("policy_documents"\)/);
  assert.match(source,/\.eq\("storage_path", documentPath\)/);
  assert.match(source,/from\("policies"\)/);
  assert.match(source,/customer\?\.profile_id === profileId/);
  assert.match(source,/\.eq\("customer_id", policy\.customer_id\)\.eq\("profile_id", profileId\)/);
});
