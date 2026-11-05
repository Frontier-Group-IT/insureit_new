import { NextResponse } from "next/server";
import { renderCompletedClaimPdf } from "@/lib/completed-claim-pdf";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail } from "@/lib/customer-web-phase2-data";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    const {account}=await resolveCustomerWebScope(new URL(request.url).searchParams.get("account"));
    const {claim,milestones,documents}=await loadCustomerClaimDetail(account.id,id);
    const completedKeys=new Set(milestones.filter(m=>m.milestone_status==="completed"||m.milestone_status==="not_applicable").map(m=>m.milestone_key));
    if(!INTERNAL_JOURNEY_STAGES.every(stage=>completedKeys.has(stage.key))) {
      return NextResponse.json({error:"The claim form is available after all nine stages are completed."},{status:409});
    }
    return renderCompletedClaimPdf(claim, milestones, documents, new URL(request.url).searchParams.get("preview")==="1");
  }catch{return NextResponse.json({error:"Unable to generate claim details PDF"},{status:404});}
}
