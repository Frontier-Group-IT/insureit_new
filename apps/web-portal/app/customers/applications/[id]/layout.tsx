import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export default async function CustomerApplicationLayout({children,params}:{children:ReactNode;params:Promise<{id:string}>}){
 const {id}=await params;
 const admin=createSupabaseAdminClient();
 const {data}=await admin.from("intermediary_onboarding_applications").select("id").eq("id",id).maybeSingle<{id:string}>();
 if(data?.id)redirect(`/intermediaries/applications/${id}`);
 return children;
}
