/** Disposable Supabase GoTrue recovery drill: synthetic passwords only. */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { customerAuthAlias } from '../../../supabase/functions/_shared/customer-firebase-session-alias.mjs';
const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!/^http:\/\/(127\.0\.0\.1|localhost):[0-9]+\/?$/.test(url??'') || !anon || !service) {
 throw Error('LOCAL ephemeral GoTrue only; never use against production');
}
const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
function client(){return createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});}
const initialPassword=randomBytes(32).toString('base64url'),rotatedPassword=randomBytes(32).toString('base64url');
const identity='recovery-'+randomBytes(6).toString('hex')+'@example.org';
let userId;
try {
 const created=await admin.auth.admin.createUser({email:identity,email_confirm:true,password:initialPassword});
 if(created.error) throw created.error;
 userId=created.data.user.id;
 const first=await client().auth.signInWithPassword({email:identity,password:initialPassword});
 assert.equal(first.error,null);assert.equal(first.data.user.id,userId);
 const alias=customerAuthAlias(userId);
 const changed=await admin.auth.admin.updateUserById(userId,{email:alias,email_confirm:true,password:rotatedPassword});
 if(changed.error) throw changed.error;
 assert.equal(changed.data.user.id,userId);
 const oldBlocked=await client().auth.signInWithPassword({email:identity,password:initialPassword});
 assert.ok(oldBlocked.error,'old address must not authenticate after alias replacement');
 const rotated=await client().auth.signInWithPassword({email:alias,password:rotatedPassword});
 assert.equal(rotated.error,null);assert.equal(rotated.data.user.id,userId);
 // Supported Admin API rollback for synthetic identity where original password
 // is known. Real production passwords are NOT recoverable through this API.
 const restored=await admin.auth.admin.updateUserById(userId,{email:identity,email_confirm:true,password:initialPassword});
 if(restored.error) throw restored.error;
 assert.equal(restored.data.user.id,userId);
 const proof=await client().auth.signInWithPassword({email:identity,password:initialPassword});
 assert.equal(proof.error,null);assert.equal(proof.data.user.id,userId);
 const after=await admin.auth.admin.getUserById(userId);
 assert.equal(after.data.user.email,identity);
 console.info('PASS disposable known-credential Auth alias rollback: original login, UUID and email restored. NOT a production password-hash recovery proof.');
}finally{
 if(userId) await admin.auth.admin.deleteUser(userId).catch(()=>undefined);
}
