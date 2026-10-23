import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { INTERNAL_JOURNEY_STAGES } from "@insureit/claim-journey";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerClaimDetail, isExternalCustomerClaim } from "@/lib/customer-web-phase2-data";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    const {account}=await resolveCustomerWebScope(new URL(request.url).searchParams.get("account"));
    const {claim,milestones,documents}=await loadCustomerClaimDetail(account.id,id);
    const pdf=await PDFDocument.create();
    const font=await pdf.embedFont(StandardFonts.Helvetica);
    const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const width=595,height=842,margin=42;
    let page=pdf.addPage([width,height]);
    let y=height-margin;
    const safe=(value:unknown)=>String(value??"Not recorded").replace(/[^\x20-\x7E]/g," ").slice(0,1500);
    const line=(label:string,value:unknown)=>{
      const text=safe(label+": "+(value==null||value===""?"Not recorded":value));
      const words=text.split(" ");
      let chunk="";
      for(const word of words){
        const trial=chunk?chunk+" "+word:word;
        if(font.widthOfTextAtSize(trial,10)>width-2*margin&&chunk){draw(chunk);chunk=word;}else{chunk=trial;}
      }
      if(chunk)draw(chunk);
    };
    const draw=(text:string)=>{
      if(y<margin+24){page=pdf.addPage([width,height]);y=height-margin;}
      page.drawText(safe(text),{x:margin,y,size:10,font,color:rgb(.12,.23,.38)});
      y-=16;
    };
    const heading=(text:string)=>{
      if(y<margin+55){page=pdf.addPage([width,height]);y=height-margin;}
      y-=9;page.drawText(safe(text),{x:margin,y,size:13,font:bold,color:rgb(.05,.18,.38)});y-=24;
    };
    heading("INSUREIT - Claim Details");
    line("Control Number",claim.claim_no);
    line("Claim Number",claim.insurer_claim_no);
    line("Claim Type",isExternalCustomerClaim(claim)?"External":"Internal");
    line("Status",claim.current_status);
    line("Vehicle",claim.vehicle_no);
    line("Make and Model",[claim.vehicle_make,claim.vehicle_model].filter(Boolean).join(" "));
    line("Insurer",claim.insurer_name);
    line("Policy Number",claim.policy_no);
    line("Accident Date",claim.accident_at);
    line("Spot Intimation",claim.spot_intimation_at);
    line("Location",claim.accident_location);
    for(const [index,stage] of INTERNAL_JOURNEY_STAGES.entries()){
      const milestone=milestones.find(x=>x.milestone_key===stage.key);
      heading((index+1)+". "+stage.label);
      line("Stage Status",milestone?.milestone_status);
      if(stage.key==="spot_intimation"){
        line("Accident Date and Time",claim.accident_at);
        line("Spot Intimation Date and Time",claim.spot_intimation_at);
        line("Location",claim.accident_location);
      }
      const entries=Object.entries(milestone?.details||{}).filter(([,v])=>["string","number","boolean"].includes(typeof v));
      if(!entries.length)line("Details","No additional details recorded");
      for(const [key,value] of entries)line(key.replace(/_/g," "),value);
      if(stage.key==="spot_intimation"||stage.key==="claim_intimation"){
        const related=documents.filter(doc=>stage.key==="spot_intimation"
          ? ["accidentphoto","spotphoto","accidentvideo","rccopy","insurancecopy","driverlicence","grloadbill","incidentvoicenote","audio"].includes(doc.document_type.toLowerCase().replace(/[^a-z0-9]/g,""))
          : !["accidentphoto","spotphoto","accidentvideo","rccopy","insurancecopy","driverlicence","grloadbill","incidentvoicenote","audio"].includes(doc.document_type.toLowerCase().replace(/[^a-z0-9]/g,"")));
        if(related.length){line("Uploaded documents",related.length);for(const doc of related)line(doc.document_type,doc.file_name||"Uploaded");}
      }
    }
    const bytes=await pdf.save();
    return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="claim-details.pdf"',"Cache-Control":"private, no-store"}});
  }catch{return NextResponse.json({error:"Unable to generate claim details PDF"},{status:404});}
}
