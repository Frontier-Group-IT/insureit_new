// Scoped Policy Intake lead-source picker. Parity with the existing
// authorizedSourceIds() website helper, including the branch parent-Partner
// exception; it does not modify intakes or expand sibling-branch visibility.
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const json=(obj:Record<string,unknown>,status=200)=>new Response(JSON.stringify(obj),{
  status,headers:{"Content-Type":"application/json","Cache-Control":"private, no-store"}
});
Deno.serve(async(req:Request)=>{
  if(req.method!=="POST")return json({ok:false,error:"Method not allowed."},405);
  const token=/^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization")??"")?.[1];
  if(!token)return json({ok:false,error:"Partner authentication required."},401);
  const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY"),
    secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key||!secret)return json({ok:false,error:"Policy Intake sources unavailable."},503);
  const client=createClient(url,key,{global:{headers:{Authorization:`Bearer ${token}`}},
    auth:{persistSession:false,autoRefreshToken:false}});
  const {data:user,error:userError}=await client.auth.getUser(token);
  if(userError||!user.user)return json({ok:false,error:"Partner session expired."},401);
  const [{data:identity,error:identityError},{data:scope,error:scopeError}]=await Promise.all([
    client.rpc("partner_app_current_identity"),client.rpc("partner_app_commercial_scope")
  ]);
  if(identityError||scopeError)return json({ok:false,error:"Partner scope temporarily unavailable."},503);
  if(!identity||!scope||identity.auth_user_id!==user.user.id||identity.actor_kind!==scope.actor_kind||
     !["employee","intermediary"].includes(identity.actor_kind))
    return json({ok:false,error:"Partner account access unavailable."},403);
  if(identity.actor_kind==="employee"){
    const {data:grants,error:grantsError}=await client.rpc("partner_app_effective_permissions");
    if(grantsError)return json({ok:false,error:"Policy Intake permissions unavailable."},503);
    if(!grants||!["view","edit","approve"].includes(grants.capabilities?.view_policy_intakes)&&
       !["edit","approve"].includes(grants.capabilities?.create_policy_intakes))
      return json({ok:false,error:"Policy Intake source access unavailable."},403);
  }
  const ids=new Set<string>();
  const storedIds=Array.isArray(scope.intermediary_ids)?scope.intermediary_ids:[];
  const explicit=identity.actor_kind==="intermediary"&&["branch","group"].includes(identity.portal_access_type);
  if(identity.actor_kind==="intermediary"&&!explicit){
    if(typeof identity.intermediary_id==="string")ids.add(identity.intermediary_id);
  }else for(const id of storedIds)if(typeof id==="string")ids.add(id);
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  if(explicit&&identity.portal_access_type==="branch"&&
      Array.isArray(scope.partner_ids)&&scope.partner_ids.includes(identity.portal_access_entity_id)){
    const {data:branch,error:branchError}=await admin.from("partners")
      .select("id,parent_partner_id,partner_status").eq("id",identity.portal_access_entity_id).maybeSingle();
    if(branchError)return json({ok:false,error:"Branch source lookup unavailable."},503);
    if(branch?.partner_status==="active_partner"&&branch.parent_partner_id){
      const {data:parent,error:parentError}=await admin.from("partners")
        .select("id,partner_status,source_application_id").eq("id",branch.parent_partner_id).maybeSingle();
      if(parentError)return json({ok:false,error:"Parent source lookup unavailable."},503);
      if(parent?.partner_status==="active_partner"&&parent.source_application_id){
        const {data:parentSource,error:sourceError}=await admin.from("intermediaries").select("id")
          .eq("application_id",parent.source_application_id)
          .eq("intermediary_type","partner").eq("account_status","active").maybeSingle();
        if(sourceError)return json({ok:false,error:"Parent intermediary lookup unavailable."},503);
        if(parentSource?.id)ids.add(parentSource.id);
      }
    }
  }
  if(!ids.size)return json({ok:true,sources:[]});
  const {data,error}=await admin.from("intermediaries")
    .select("id,intermediary_type,display_name,intermediary_code,account_status")
    .in("id",[...ids]).eq("account_status","active").order("display_name");
  if(error)return json({ok:false,error:"Authorized lead sources could not be loaded."},503);
  return json({ok:true,sources:data??[]});
});
