/**
 * Local ephemeral GoTrue integration: original-UUID refresh + A/B switching.
 * No Firebase OTP, production network, Customer records, or secret exports.
 */
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY;
const service=process.env.SUPABASE_SERVICE_ROLE_KEY,dbUrl=process.env.SUPABASE_DB_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url??'') ||
    !anon || !service || !dbUrl ||
    !/@(127\.0\.0\.1|localhost):54322\//.test(dbUrl)) {
  throw Error('Refusing nonlocal or unconfigured Supabase GoTrue test');
}
const svc=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
const freshClient=()=>createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const random=()=>randomBytes(24).toString('base64url');
const passwordA=random(), passwordB=random();
const emailA='a-'+randomBytes(7).toString('hex')+'@example.org';
const emailB='b-'+randomBytes(7).toString('hex')+'@example.org';
const users=[];
function localSql(query){
  const r=spawnSync('psql',[dbUrl,'-v','ON_ERROR_STOP=1','-qAtc',query],{encoding:'utf8'});
  if(r.status!==0)throw Error('Disposable PostgreSQL fixture failed');
  return r.stdout.trim();
}
try {
  for(const [email,password] of [[emailA,passwordA],[emailB,passwordB]]){
    const c=await svc.auth.admin.createUser({email,email_confirm:true,password});
    if(c.error||!c.data?.user?.id)throw Error('Disposable Auth user creation failed');
    users.push(c.data.user.id);
  }
  const [aId,bId]=users;
  assert.match(aId,/^[0-9a-f-]{36}$/i);
  assert.match(bId,/^[0-9a-f-]{36}$/i);
  localSql("create table public.firebase_customer_rls_probe(id integer primary key,"+
    "owner_id uuid not null,kind text not null);"+
    "alter table public.firebase_customer_rls_probe enable row level security;"+
    "grant select on public.firebase_customer_rls_probe to authenticated;"+
    "create policy own_customer_only on public.firebase_customer_rls_probe "+
    "for select to authenticated using(owner_id=auth.uid());"+
    "insert into public.firebase_customer_rls_probe values"+
    "(1,'"+aId+"','policy'),(2,'"+aId+"','vehicle'),(3,'"+bId+"','claim');");
  const a=freshClient(),b=freshClient();
  const aSign=await a.auth.signInWithPassword({email:emailA,password:passwordA});
  const bSign=await b.auth.signInWithPassword({email:emailB,password:passwordB});
  assert.equal(aSign.error,null);assert.equal(bSign.error,null);
  assert.equal(aSign.data.session.user.id,aId);
  assert.equal(bSign.data.session.user.id,bId);
  const count=async client=>{
    const r=await client.from('firebase_customer_rls_probe').select('id,kind');
    assert.equal(r.error,null);
    return r.data.map(x=>x.kind).sort();
  };
  assert.deepEqual(await count(a),['policy','vehicle']);
  assert.deepEqual(await count(b),['claim']);
  // Actual GoTrue refresh, not just an app-restart cached session.
  const rotated=await a.auth.refreshSession();
  assert.equal(rotated.error,null);
  assert.equal(rotated.data.session?.user?.id,aId);
  assert.ok(rotated.data.session?.refresh_token);
  const signedA=rotated.data.session;
  assert.deepEqual(await count(a),['policy','vehicle']);
  // Remembered-account switching must swap the actual signed session.
  const bSession=bSign.data.session;
  const toB=await a.auth.setSession({
    access_token:bSession.access_token,refresh_token:bSession.refresh_token,
  });
  assert.equal(toB.error,null);assert.equal(toB.data.session?.user?.id,bId);
  assert.deepEqual(await count(a),['claim']);
  const backToA=await a.auth.setSession({
    access_token:signedA.access_token,refresh_token:signedA.refresh_token,
  });
  assert.equal(backToA.error,null);assert.equal(backToA.data.session?.user?.id,aId);
  assert.deepEqual(await count(a),['policy','vehicle']);
  const identity=await a.auth.getUser();
  assert.equal(identity.error,null);assert.equal(identity.data.user.id,aId);
  console.info('PASS local GoTrue refresh, same UUID, Customer A/B RLS and account switching. Not production isolation.');
}finally{
  try{localSql('drop table if exists public.firebase_customer_rls_probe')}catch{}
  for(const id of users)await svc.auth.admin.deleteUser(id).catch(()=>undefined);
}
