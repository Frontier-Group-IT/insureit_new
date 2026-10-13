/**
 * Safe, READ-ONLY, staging verification for independent Firebase customer A/B.
 * Run only after the PostgREST Firebase claim adapter has passed migration review.
 * Requires TWO real Firebase ID tokens (do not commit/log them), an approved
 * mapping for each, and independently owned customer IDs in a preview DB.
 *
 * ENV: SUPABASE_URL, SUPABASE_ANON_KEY,
 * FIREBASE_CUSTOMER_A_TOKEN, FIREBASE_CUSTOMER_B_TOKEN,
 * FIREBASE_CUSTOMER_A_ID, FIREBASE_CUSTOMER_B_ID,
 * FIREBASE_CUSTOMER_A_PROFILE_ID, FIREBASE_CUSTOMER_B_PROFILE_ID.
 *
 * Never auto-run in production. No writes, deletes, or signed URLs.
 */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const productionRef = 'ilzhsfqqjyppzzvfscmh';
const names = [
  'SUPABASE_URL','SUPABASE_ANON_KEY',
  'FIREBASE_CUSTOMER_A_TOKEN','FIREBASE_CUSTOMER_B_TOKEN',
  'FIREBASE_CUSTOMER_A_ID','FIREBASE_CUSTOMER_B_ID',
  'FIREBASE_CUSTOMER_A_PROFILE_ID','FIREBASE_CUSTOMER_B_PROFILE_ID',
];
for (const name of names) assert.ok(process.env[name], `Missing required staging variable: ${name}`);
const url = process.env.SUPABASE_URL;
assert.ok(!url.includes(productionRef), 'Refusing to test against live production Supabase');
assert.equal(process.env.CONFIRM_STAGING_CUSTOMER_TESTS, 'YES', 'Explicit staging test confirmation required');
const key = process.env.SUPABASE_ANON_KEY;
const clientFor = (token) => createClient(url, key, {
  accessToken: async () => token,
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const a = clientFor(process.env.FIREBASE_CUSTOMER_A_TOKEN);
const b = clientFor(process.env.FIREBASE_CUSTOMER_B_TOKEN);
const aId = process.env.FIREBASE_CUSTOMER_A_ID;
const bId = process.env.FIREBASE_CUSTOMER_B_ID;
const aProfile = process.env.FIREBASE_CUSTOMER_A_PROFILE_ID;
const bProfile = process.env.FIREBASE_CUSTOMER_B_PROFILE_ID;
assert.notEqual(aId,bId,'Independent customers required');
assert.notEqual(aProfile,bProfile,'Independent profile identities required');

async function read(table, client, column, id) {
  const { data, error } = await client.from(table).select('*').eq(column,id).limit(2);
  assert.ifError(error);
  return data ?? [];
}
async function run() {
  const [resolvedA,resolvedB] = await Promise.all([
    a.rpc('customer_firebase_profile_id'),
    b.rpc('customer_firebase_profile_id'),
  ]);
  assert.ifError(resolvedA.error);
  assert.ifError(resolvedB.error);
  assert.equal(resolvedA.data,aProfile,'Firebase A canonical ID');
  assert.equal(resolvedB.data,bProfile,'Firebase B canonical ID');
  assert.equal((await read('profiles',a,'id',bProfile)).length,0,'A denied B profile');
  assert.equal((await read('profiles',b,'id',aProfile)).length,0,'B denied A profile');
  assert.equal((await read('profiles',a,'id',aProfile)).length,1,'A can read own profile');
  assert.equal((await read('profiles',b,'id',bProfile)).length,1,'B can read own profile');
  for(const table of ['customers','vehicles','policies','claims','claim_documents']) {
    const column=table==='customers'?'id':'customer_id';
    assert.equal((await read(table,a,column,bId)).length,0,`A denied B ${table}`);
    assert.equal((await read(table,b,column,aId)).length,0,`B denied A ${table}`);
  }
  const noBearer = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const unauthenticated = await noBearer.rpc('customer_firebase_profile_id');
  assert.ok(unauthenticated.error || unauthenticated.data === null,'anonymous Firebase resolver denied');
  console.log('PASS: staging Firebase profile ownership, cross-customer reads and anonymous denial');
}
run().catch(error=>{
  console.error('FAIL: staging Firebase authorization regression:',error.message);
  process.exitCode=1;
});
