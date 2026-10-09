const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../../supabase/functions/customer-firebase-bind/index.ts'),'utf8');
test('Firebase Admin checks revoked token before any privileged data access',()=>{
  assert.match(source,/verifyIdToken\(bearer\[1\], true\)/);
  assert.ok(source.indexOf('verifyIdToken(bearer[1], true)') < source.indexOf('createClient(supabaseUrl, serviceKey'));
});
test('inactive mapping denied and role assigned after link stored',()=>{
  assert.match(source,/existing\.some\(\(l\) => !l\.is_approved \|\| !l\.is_active\)/);
  assert.ok(source.indexOf('if (insertError) return') < source.indexOf('setCustomUserClaims(decoded.uid'));
});
test('no client supplied profile, role or phone can influence account binding',()=>{
  assert.doesNotMatch(source,/await request\.json\(/);
  assert.match(source,/const matches = profiles\.filter\(\(p\) => p\.phone === decoded\.phone_number\)/);
  assert.match(source,/\.eq\("firebase_project_id", PROJECT\)/);
});
