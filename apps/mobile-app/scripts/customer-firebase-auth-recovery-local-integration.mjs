/** Disposable Supabase GoTrue recovery drill: synthetic passwords only. */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { customerAuthAlias } from '../../../supabase/functions/_shared/customer-firebase-session-alias.mjs';
const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost):[0-9]+\/?$/.test(url??'') || !anon || !service) {
 throw Error('LOCAL ephemeral GoTrue only; never use against production');
}
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
function client(){return createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});}
const initialPassword=randomBytes(32).toString('base64url'),rotatedPassword=randomBytes(32).toString('base64url');
const identity='recovery-'+randomBytes(6).toString('hex')+'@example.org';
const dbUrl=process.env.SUPABASE_DB_URL;
if (!dbUrl || !/@(127\.0\.0\.1|localhost):54322\//.test(dbUrl)) throw Error('Localhost DB only');
function psql(sql) {
 const run=spawnSync('psql',[dbUrl,'-v','ON_ERROR_STOP=1','-Atqc',sql],{encoding:'utf8'});
 if(run.status!==0) throw Error('Disposable Auth restore SQL failed');
 return run.stdout.trim();
}
let userId;
let backedUp=false;
try {
 const created=await admin.auth.admin.createUser({email:identity,email_confirm:true,password:initialPassword});
 if(created.error) throw created.error;
 userId=created.data.user.id;
 const first=await client().auth.signInWithPassword({email:identity,password:initialPassword});
 assert.equal(first.error,null);assert.equal(first.data.user.id,userId);
 // Capture real encrypted credential and identity rows ONLY in disposable local DB.
 psql("create table auth._firebase_recovery_user as select * from auth.users where id='"+userId+"'; "+
      "create table auth._firebase_recovery_identities as select * from auth.identities where user_id='"+userId+"';");
 backedUp=true;
 assert.equal(psql('select count(*) from auth._firebase_recovery_user'),'1');
 const alias=customerAuthAlias(userId);
 const changed=await admin.auth.admin.updateUserById(userId,{email:alias,email_confirm:true,password:rotatedPassword});
 if(changed.error) throw changed.error;
 assert.equal(changed.data.user.id,userId);
 const oldBlocked=await client().auth.signInWithPassword({email:identity,password:initialPassword});
 assert.ok(oldBlocked.error,'old address must not authenticate after alias replacement');
 const rotated=await client().auth.signInWithPassword({email:alias,password:rotatedPassword});
 assert.equal(rotated.error,null);assert.equal(rotated.data.user.id,userId);
 // Restore original encrypted password and identity rows atomically in disposable DB.
 psql("begin; "+
      "delete from auth.identities where user_id='"+userId+"'; "+
      "update auth.users u set email=s.email,encrypted_password=s.encrypted_password,email_confirmed_at=s.email_confirmed_at,updated_at=now() "+
      "from auth._firebase_recovery_user s where u.id=s.id and u.id='"+userId+"'; "+
      "insert into auth.identities (provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id) "+
      "select provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at,id from auth._firebase_recovery_identities; commit;");
 const proof=await client().auth.signInWithPassword({email:identity,password:initialPassword});
 assert.equal(proof.error,null);assert.equal(proof.data.user.id,userId);
 const after=await admin.auth.admin.getUserById(userId);
 assert.equal(after.data.user.email,identity);
 console.info('PASS local GoTrue original encrypted password and identity rows restored; old login and UUID verified. Not production restoration.');
}finally{
 if(userId) await admin.auth.admin.deleteUser(userId).catch(()=>undefined);
 if(backedUp) psql('drop table if exists auth._firebase_recovery_identities; drop table if exists auth._firebase_recovery_user;');
}
