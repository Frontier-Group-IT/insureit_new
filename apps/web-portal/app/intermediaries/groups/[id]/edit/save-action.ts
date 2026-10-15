"use server";
import {redirect} from "next/navigation";
import {revalidatePath} from "next/cache";
import {createSupabaseAdminClient} from "@/lib/supabase-admin";
import {requireGroupAssociateManager} from "../../group-associate-access";
const get=(f:FormData,k:string)=>String(f.get(k)??"").trim();
export async function saveGroupReviewDetails(f:FormData){
 const id=get(f,"group_id");
 if(!/^[a-f0-9-]{36}$/i.test(id))redirect("/access-denied");
 const actor=await requireGroupAssociateManager(id);
 const groupName=get(f,"group_name");
 if(!groupName)redirect(`/intermediaries/groups/${id}/edit`);
 const admin=createSupabaseAdminClient();
 const {error:groupError}=await admin.from("intermediary_groups").update({group_name:groupName,description:get(f,"description")||null}).eq("id",id).eq("status","active");
 if(groupError)throw new Error("Unable to save Group information.");
 const {data:current}=await admin.from("group_administrator_contacts").select("group_id").eq("group_id",id).maybeSingle();
 if(current){
  const postal=get(f,"postal_code");
  if(postal&&!/^\d{6}$/.test(postal))throw new Error("Enter a valid PIN code.");
  const {error}=await admin.from("group_administrator_contacts").update({
   admin_name:get(f,"admin_name"),admin_mobile:get(f,"admin_mobile"),
   address:get(f,"address"),city:get(f,"city"),state:get(f,"state"),postal_code:postal,updated_by:actor.actorId,updated_at:new Date().toISOString()
  }).eq("group_id",id);
  if(error)throw new Error("Unable to save Group administrator details.");
 }
 revalidatePath(`/intermediaries/groups/${id}`);
 redirect(`/intermediaries/groups/${id}?success=updated`);
}
