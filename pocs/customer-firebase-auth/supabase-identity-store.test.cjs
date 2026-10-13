const assert = require('node:assert/strict');
const { test } = require('node:test');
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const file = path.join(__dirname,'supabase-identity-store.ts');
const js = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const mod = new Module(file,module);mod.filename=file;mod.paths=module.paths;mod._compile(js,file);
const {createCustomerFirebaseIdentityStore}=mod.exports;
const uid='firebase-uid-1';
function client(data,error=null) {
  const filters={};
  return {
    filters,
    from(table){assert.equal(table,'customer_firebase_identity_links');return {
      select(columns){assert.match(columns,/profiles!customer_firebase_identity_links_profile_id_fkey/);return {
        eq(column,value){filters[column]=value;return {
          eq(column2,value2){filters[column2]=value2;return Promise.resolve({data,error});}
        };}
      };}
    };}
  };
}
const row={firebase_uid:uid,profile_id:'123e4567-e89b-42d3-a456-426614174000',verified_phone_at_approval:'+919876543210',is_approved:true,is_active:true,profiles:{role:'customer',is_active:true}};
test('lookup is project-scoped and maps one linked customer',async()=>{
  const c=client([row]);const links=await createCustomerFirebaseIdentityStore(c)(uid);
  assert.equal(c.filters.firebase_project_id,'insureit-customer-auth');
  assert.equal(c.filters.firebase_uid,uid);
  assert.equal(links[0].profileId,row.profile_id);
  assert.equal(links[0].profileActive,true);
});
test('lookup fails closed on DB error, malformed relation and bad UID',async()=>{
  await assert.rejects(createCustomerFirebaseIdentityStore(client([], {message:'DB down'}))(uid),/unavailable/);
  await assert.rejects(createCustomerFirebaseIdentityStore(client([{...row,profiles:null}]))(uid),/Malformed/);
  await assert.rejects(createCustomerFirebaseIdentityStore(client([]))(''),/Invalid/);
});
