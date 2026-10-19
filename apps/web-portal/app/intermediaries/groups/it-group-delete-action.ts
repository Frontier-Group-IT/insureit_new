"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function deleteUnlinkedGroup(groupId: string): Promise<{ok:boolean;message:string}> {
  const token = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(token);
  if (!profile?.id || profile.role !== "it_super_user") {
    return {ok:false,message:"Only IT Super User can delete an Intermediary Group."};
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(groupId)) {
    return {ok:false,message:"Invalid group ID."};
  }
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.rpc("it_delete_unlinked_intermediary_group",{p_group_id:groupId});
  if(error) return {ok:false,message:"Group could not be deleted. It may have linked partners, accounts, policies, audit history or login identities. No linked records were deleted."};
  if(!data) return {ok:false,message:"Group was not found."};
  revalidatePath("/intermediaries/groups");
  return {ok:true,message:"Group deleted successfully."};
}
