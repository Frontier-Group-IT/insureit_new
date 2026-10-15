"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireGroupAssociateManager } from "../../group-associate-access";
const root="/intermediaries/groups";
const str=(f:FormData,k:string)=>String(f.get(k)??"").trim();
const emailValid=(s:string)=>/^\S+@\S+\.\S+$/.test(s);
const validUuid=(s:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
const pathFor=(id:string)=>`${root}/${id}/associate-accounts`;
function finishResult(id:string,message:string,error=false,portal=false):never{
 revalidatePath(pathFor(id));
 const target=portal?"/partner/group-associates":pathFor(id);
 revalidatePath(target);
 redirect(`${target}?${error?"error":"success"}=${encodeURIComponent(message)}`);
}
async function context(f:FormData){
 const groupId=str(f,"group_id");
 if(!validUuid(groupId))redirect("/access-denied");
 const actor=await requireGroupAssociateManager(groupId);
 return {groupId,actor,admin:createSupabaseAdminClient()};
}
async function log(admin:ReturnType<typeof createSupabaseAdminClient>,groupId:string,actorId:string,associateId:string|null,event:string){
 const {error}=await admin.from("group_portal_associate_audit").insert({group_id:groupId,actor_id:actorId,associate_id:associateId,event_type:event});
 if(error)console.error("Group associate audit failure",error.code);
}
export async function createGroupAssociate(f:FormData){
 const finish=(id:string,message:string,error=false):never=>finishResult(id,message,error,str(f,"portal_surface")==="partner");
 const {groupId,actor,admin}=await context(f);
 const name=str(f,"name"),phone=str(f,"phone").replace(/[^0-9+]/g,""),email=str(f,"email").toLowerCase(),designation=str(f,"designation");
 const role=str(f,"role");
 if(!name||!designation||!emailValid(email)||!/^\+?[0-9]{7,15}$/.test(phone)||!["insurance_head","claim_head","bodyshop_manager"].includes(role))finish(groupId,"Enter valid details and choose an available role.",true);
 const [{data:authProfile},{data:primary},{data:associate},{data:partnerLogin},{data:groupLogin}]=await Promise.all([
  admin.from("profiles").select("id").ilike("email",email).limit(1),
  admin.from("portal_access_identities").select("id").ilike("login_email",email).limit(1),
  admin.from("group_portal_associate_accounts").select("id").ilike("email",email).limit(1),
  admin.from("intermediary_portal_accounts").select("id").ilike("email",email).limit(1),
  admin.from("intermediary_groups").select("id").eq("id",groupId).eq("status","active").maybeSingle()
 ]);
 if(!groupLogin)finish(groupId,"Group is not active.",true);
 if(authProfile?.length||primary?.length||associate?.length||partnerLogin?.length)finish(groupId,"Email is already linked to an existing portal account.",true);
 const {data:invite,error:invErr}=await admin.auth.admin.inviteUserByEmail(email,{
  redirectTo:`${(process.env.NEXT_PUBLIC_PORTAL_URL||"https://portal.insureit.in").replace(/\/$/,"")}/auth/callback?next=/intermediary-portal`,
  data:{full_name:name,role:"intermediary",portal_account_type:"group_associate",group_id:groupId,group_associate_role:role}
 });
 if(invErr||!invite.user?.id)return finish(groupId,"Unable to send activation email. Check Auth email configuration and rate limit.",true);
 const authId=invite.user.id,now=new Date().toISOString();
 const {error:profileError}=await admin.from("profiles").upsert({id:authId,full_name:name,role:"intermediary",email,phone,is_active:true,updated_at:now},{onConflict:"id"});
 if(profileError){await admin.auth.admin.deleteUser(authId);finish(groupId,"Unable to create the associate profile.",true)}
 const {data:newAccount,error:accountError}=await admin.from("group_portal_associate_accounts").insert({
  group_id:groupId,auth_user_id:authId,name,phone_number:phone,email,designation,
  address:str(f,"address")||null,city:str(f,"city")||null,state:str(f,"state")||null,
  postal_code:str(f,"postal_code")||null,role,status:"invited",invited_at:now,
  created_by:actor.actorId,updated_by:actor.actorId
 }).select("id").single();
 if(accountError||!newAccount){await admin.auth.admin.deleteUser(authId);return finish(groupId,"Unable to link associate to Group. No access was granted.",true)}
 await log(admin,groupId,actor.actorId,newAccount.id,"invited");
 finish(groupId,"Associate created. Activation email sent.");
}
export async function manageGroupAssociate(f:FormData){
 const finish=(id:string,message:string,error=false):never=>finishResult(id,message,error,str(f,"portal_surface")==="partner");
 const {groupId,actor,admin}=await context(f);
 const associateId=str(f,"associate_id"),operation=str(f,"operation");
 if(!validUuid(associateId))finish(groupId,"Invalid associate account.",true);
 const {data:associate}=await admin.from("group_portal_associate_accounts")
 .select("id,auth_user_id,email,status,invited_at,name").eq("id",associateId).eq("group_id",groupId).maybeSingle();
 if(!associate)return finish(groupId,"Associate account not found in this Group.",true);
 // The primary Group login is not stored in this table and can never be targeted.
 if(operation==="resend"){
  if(associate.status==="disabled")finish(groupId,"Enable the associate before resending the link.",true);
  if(associate.invited_at&&Date.now()-new Date(associate.invited_at).getTime()<60000)finish(groupId,"Please wait 60 seconds before sending another email.",true);
  const {error}=await admin.auth.resetPasswordForEmail(associate.email,{redirectTo:`${(process.env.NEXT_PUBLIC_PORTAL_URL||"https://portal.insureit.in").replace(/\/$/,"")}/auth/callback?next=/intermediary-portal`});
  if(error)finish(groupId,"Unable to resend invitation. Try again later.",true);
  await admin.from("group_portal_associate_accounts").update({invited_at:new Date().toISOString(),updated_by:actor.actorId}).eq("id",associate.id).eq("group_id",groupId);
  await log(admin,groupId,actor.actorId,associate.id,"resent");
  finish(groupId,"Activation link sent.");
 }
 if(operation==="disable"||operation==="enable"){
  const disabling=operation==="disable",status=disabling?"disabled":"active";
  const {error}=await admin.from("profiles").update({is_active:!disabling}).eq("id",associate.auth_user_id);
  if(error)finish(groupId,"Unable to update login status.",true);
  const {error:accountError}=await admin.from("group_portal_associate_accounts").update({status:status,disabled_at:disabling?new Date().toISOString():null,updated_by:actor.actorId}).eq("id",associate.id).eq("group_id",groupId);
  if(accountError){await admin.from("profiles").update({is_active:disabling}).eq("id",associate.auth_user_id);finish(groupId,"Unable to update associate status.",true)}
  await log(admin,groupId,actor.actorId,associate.id,status);
  finish(groupId,disabling?"Associate disabled.":"Associate enabled.");
 }
 if(operation==="delete"){
  if(actor.actorId===associate.auth_user_id)finish(groupId,"You cannot delete your own active account.",true);
  const {error}=await admin.auth.admin.deleteUser(associate.auth_user_id);
  if(error)finish(groupId,"Could not delete account due to linked data.",true);
  await log(admin,groupId,actor.actorId,null,"deleted");
  finish(groupId,"Associate login deleted.");
 }
 finish(groupId,"Unsupported action.",true);
}
export async function updateGroupAssociate(f:FormData){
 const finish=(id:string,message:string,error=false):never=>finishResult(id,message,error,str(f,"portal_surface")==="partner");
 const {groupId,actor,admin}=await context(f);
 const associateId=str(f,"associate_id"),name=str(f,"name"),designation=str(f,"designation"),phone=str(f,"phone").replace(/[^0-9+]/g,"");
 if(!validUuid(associateId)||!name||!designation||!/^\+?[0-9]{7,15}$/.test(phone))finish(groupId,"Check required fields.",true);
 const {data:a}=await admin.from("group_portal_associate_accounts").select("auth_user_id").eq("id",associateId).eq("group_id",groupId).maybeSingle();
 if(!a)return finish(groupId,"Group associate not found.",true);
 const {error}=await admin.from("group_portal_associate_accounts").update({name,phone_number:phone,designation,address:str(f,"address")||null,city:str(f,"city")||null,state:str(f,"state")||null,postal_code:str(f,"postal_code")||null,updated_by:actor.actorId}).eq("id",associateId).eq("group_id",groupId);
 if(error)finish(groupId,"Unable to save associate details.",true);
 await admin.from("profiles").update({full_name:name,phone}).eq("id",a.auth_user_id);
 await log(admin,groupId,actor.actorId,associateId,"updated");
 finish(groupId,"Associate details updated.");
}
