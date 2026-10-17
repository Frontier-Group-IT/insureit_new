/** Local-only, disposable integration proof for atomic Firebase UID enrollment RPC. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY,dbUrl=process.env.SUPABASE_DB_URL;
if (!/^http:\/\/(localhost|127\.0\.0\.1):[0-9]+\/?$/.test(url??'') || !dbUrl?.includes('@127.0.0.1:54322/') && !dbUrl?.includes('@localhost:54322/') || !anon || !service)
 throw Error('REFUSED: ephemeral localhost Supabase API/DB required');
function sql(s) {
 const p=spawnSync('psql',[dbUrl,'-v','ON_ERROR_STOP=1','-Atqc',s],{encoding:'utf8'});
 if(p.status!==0) throw Error('local SQL assertion/setup failed: '+(p.stderr??'').slice(0,400));
 return p.stdout.trim();
}
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const ordinary=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
let id;
try {
 const created=await admin.auth.admin.createUser({phone:'+919876543210',phone_confirm:true});
 if(created.error) throw created.error; id=created.data.user.id;
 const operator='22222222-2222-4222-8222-222222222222';
 sql(`insert into public.profiles(id,role,is_active,phone) values ('${id}','customer',true,'919876543210'),('${operator}','it_super_user',true,'919999999999')`);
 const args={p_profile_id:id,p_firebase_uid:'local-fixture-uid',p_verified_phone:'+919876543210',p_operator_id:operator,p_evidence_digest:'a'.repeat(64)};
 const unauth=await ordinary.rpc('customer_firebase_enroll_approved',args);
 assert.ok(unauth.error,'anon must not enroll');
 const concurrent=await Promise.all([admin.rpc('customer_firebase_enroll_approved',args),admin.rpc('customer_firebase_enroll_approved',args)]);
 for (const one of concurrent) if(one.error) throw Error('local enrollment failed '+one.error.code+' '+one.error.message);
 assert.deepEqual(concurrent.map(x=>x.data).sort(),['already_approved','enrolled']);
 const again=await admin.rpc('customer_firebase_enroll_approved',args);
 assert.equal(again.error,null);assert.equal(again.data,'already_approved');
 assert.equal(sql(`select count(*) from public.customer_firebase_identity_links where profile_id='${id}'`),'1');
 assert.equal(sql(`select count(*) from public.customer_firebase_migration_audit where customer_profile_id='${id}'`),'1');
 const conflict=await admin.rpc('customer_firebase_enroll_approved',{...args,p_firebase_uid:'another-uid'});
 assert.ok(conflict.error,'UID reassignment must fail');
 const wrong=await admin.rpc('customer_firebase_enroll_approved',{...args,p_verified_phone:'+919999999999'});
 assert.ok(wrong.error,'phone conflict must fail');
 assert.equal(sql(`select count(*) from public.customer_firebase_migration_audit where customer_profile_id='${id}'`),'1');
 console.info('PASS: real local PostgREST RPC, atomic approved link + one audit, idempotent retry, anon and conflict rejection; no production data');
} finally {
 if(id) {
  sql(`delete from public.customer_firebase_migration_audit where customer_profile_id='${id}';delete from public.customer_firebase_identity_links where profile_id='${id}';delete from public.profiles where id in ('${id}','22222222-2222-4222-8222-222222222222')`);
  await admin.auth.admin.deleteUser(id).catch(()=>undefined);
 }
}
