const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../../supabase/functions/customer-firebase-upload-url/index.ts'),'utf8');

test('signed upload ticket endpoint checks signed and non-revoked Firebase phone identity',()=>{
 assert.match(code,/verifyIdToken\(bearer\[1\], true\)/);
 assert.match(code,/decoded\.aud !== PROJECT/);
 assert.match(code,/decoded\.iss !== ISSUER/);
 assert.match(code,/decoded\.firebase\?\.sign_in_provider !== "phone"/);
 assert.match(code,/decoded\.role !== "authenticated"/);
 assert.match(code,/links\.length !== 1 \|\| !links\[0\]\.is_approved \|\| !links\[0\]\.is_active/);
 assert.match(code,/canonicalPhone\(profile\.phone\) !== decoded\.phone_number/);
 assert.ok(code.indexOf('verifyIdToken(bearer[1], true)')<code.indexOf('createClient(url, key'));
});

test('upload tickets are strictly path and customer-ownership scoped',()=>{
 assert.match(code,/bucket !== "claim-documents" && bucket !== "customer-documents"/);
 assert.match(code,/segments\.length < 3 \|\| !UUID\.test\(segments\[1\]\)/);
 assert.match(code,/claim\?\.customer_id === customerId/);
 assert.match(code,/customer\.profile_id === profileId/);
 assert.match(code,/\.eq\("status", "active"\)\.limit\(1\)/);
 assert.match(code,/application\.profile_id === profileId/);
 assert.match(code,/application\.source === "customer_app"/);
 assert.match(code,/document_upload_not_authorized/);
 assert.match(code,/Object\.keys\(input\)\.some\(\(key\) => !\["bucket", "path"\]\.includes\(key\)\)/);
 assert.match(code,/size > 2048/);
});

test('ticket grants only a non-upsert scoped upload, not delete or metadata rights',()=>{
 assert.match(code,/createSignedUploadUrl\(objectPath, \{ upsert: false \}\)/);
 assert.match(code,/ticket\.token/);
 assert.doesNotMatch(code,/\.delete\(|\.remove\(|\.update\(|\.insert\(|\.upload\(/);
 assert.doesNotMatch(code,/return reply\(200,[\s\S]*serviceRole/);
});
