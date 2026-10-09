const assert = require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const s=fs.readFileSync(path.join(__dirname,'../../apps/mobile-app/lib/firebase-upload-client.ts'),'utf8');

test('customer upload client requests phone-signed ownership ticket',()=>{
 assert.match(s,/getAuth\(\)\.currentUser\?\.getIdToken\(\)/);
 assert.match(s,/functions\/v1\/customer-firebase-upload-url/);
 assert.match(s,/body: JSON\.stringify\(\{ bucket, path \}\)/);
 assert.match(s,/ticket\.bucket !== bucket \|\| ticket\.path !== path/);
 assert.match(s,/ticket\.signedUrl\.startsWith\(base \+ '\/storage\/v1\/'\)/);
 assert.match(s,/getAuth\(\)\.currentUser\?\.uid !== uid/);
});
test('uploads use public client with a non-upsert, path-bound signed URL',()=>{
 assert.match(s,/createClient\(base, publicKey/);
 assert.match(s,/uploadToSignedUrl\(path, ticket\.token, file/);
 assert.match(s,/upsert: false/);
 assert.match(s,/persistSession: false/);
 assert.doesNotMatch(s,/SERVICE_ROLE_KEY|service_role/);
 assert.doesNotMatch(s,/\.upload\(/);
});
