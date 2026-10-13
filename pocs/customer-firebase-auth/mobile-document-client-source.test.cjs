const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../../apps/mobile-app/lib/firebase-document-client.ts'),'utf8');

test('Firebase document reader never includes privileged server key or claimed profile IDs',()=>{
  assert.match(source,/getAuth\(\)\.currentUser/);
  assert.match(source,/user\.getIdToken\(\)/);
  assert.match(source,/Authorization: \x60Bearer \$\{token\}\x60/);
  assert.match(source,/customer-firebase-doc-read/);
  assert.doesNotMatch(source,/SERVICE_ROLE_KEY|service_role|profileId|profile_id/);
});
test('Firebase document signed URL must be short lived and bound to known service',()=>{
  assert.match(source,/expiresIn > 60/);
  assert.match(source,/url\.startsWith\(base \+ '\/storage\/v1\/'\)/);
  assert.match(source,/if \(!response\.ok\) throw/);
  assert.match(source,/\['claim-documents', 'customer-documents', 'policy-documents'\]/);
});
