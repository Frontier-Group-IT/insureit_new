import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  const {id}=await params;
  const query=new URL(request.url).searchParams;
  try {
    const {account}=await resolveCustomerWebScope(query.get("account"));
    const claimId=query.get("claim");
    if(!claimId) return NextResponse.json({error:"Document unavailable"},{status:404});
    const {claim}=await loadCustomerClaimDetail(account.id,claimId);
    const db=await createServerSupabaseClient();
    const {data:document,error}=await db.from("claim_documents").select("id,claim_id,customer_id,storage_bucket,storage_path").eq("id",id).eq("claim_id",claim.id).eq("customer_id",account.id).maybeSingle();
    if(error||!document?.storage_bucket||!document.storage_path) return NextResponse.json({error:"Document unavailable"},{status:404});
    const {data:signed,error:signError}=await db.storage.from(document.storage_bucket).createSignedUrl(document.storage_path,60);
    if(signError||!signed?.signedUrl) return NextResponse.json({error:"Document could not be opened"},{status:403});
    return NextResponse.redirect(signed.signedUrl);
  } catch {return NextResponse.json({error:"Document unavailable"},{status:404});}
}
