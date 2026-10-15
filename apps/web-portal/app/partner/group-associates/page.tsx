import { redirect } from "next/navigation";
import { getPartnerWebSession } from "@/lib/partner-web";
import GroupAssociatesPage from "@/app/intermediaries/groups/[id]/associate-accounts/page";
export const dynamic="force-dynamic";
export default async function GroupPortalAssociates({searchParams}:{searchParams:Promise<{success?:string,error?:string}>}){
 const {identity,scope}=await getPartnerWebSession();
 if(scope.scope_mode!=="hierarchy"||scope.group_ids.length!==1||identity.actor_kind!=="intermediary")redirect("/partner");
 const groupId=scope.group_ids[0];
 return GroupAssociatesPage({params:Promise.resolve({id:groupId}),searchParams,surface:"partner"});
}
