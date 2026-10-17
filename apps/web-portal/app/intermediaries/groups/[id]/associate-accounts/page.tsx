import { renderGroupAssociates } from "./route-content";
export const dynamic="force-dynamic";
export default async function GroupAssociatesPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{success?:string;error?:string}>}){
 const {id}=await params;
 return renderGroupAssociates({id,query:await searchParams,surface:"operations"});
}
