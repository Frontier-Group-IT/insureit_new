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
    const completedKeys=new Set(milestones.filter(m=>m.milestone_status==="completed"||m.milestone_status==="not_applicable").map(m=>m.milestone_key));
    if(!INTERNAL_JOURNEY_STAGES.every(stage=>completedKeys.has(stage.key))) {
      return NextResponse.json({error:"The claim form is available after all nine stages are completed."},{status:409});
    }
    const pdf=await PDFDocument.create();
    const font=await pdf.embedFont(StandardFonts.Helvetica);
    const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
    const pageWidth=595.28,pageHeight=841.89,margin=26;
    const innerWidth=pageWidth-2*margin;
    const ink=rgb(.11,.14,.19), navy=rgb(.06,.17,.35), rule=rgb(.47,.51,.57);
    const shade=rgb(.92,.94,.97);
    let page=pdf.addPage([pageWidth,pageHeight]);
    let y=pageHeight-margin;
    const display=(value:unknown):unknown=>{
      if(typeof value==="boolean")return value?"Yes":"No";
      if(typeof value!=="string")return value;
      const raw=value.trim();
      if(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(raw)){
        const date=raw.slice(0,10);
        const [year,month,day]=date.split("-");
        // Display the saved calendar date without timezone conversion.
        if(raw.length===10)return `${day}-${month}-${year}`;
        const clock=raw.match(/T(\d{2}:\d{2})/);
        return clock?`${day}-${month}-${year} ${clock[1]}`:`${day}-${month}-${year}`;
      }
      return raw;
    };
    const safe=(value:unknown):string=>String(value==null||value===""?"Not recorded":display(value))
      .replace(/[^\x20-\x7E]/g," ").replace(/\s+/g," ").trim().slice(0,1400);
    const wrap=(raw:unknown,maxWidth:number,size=8.2,face=font):string[]=>{
      const words=safe(raw).split(" ");
      const lines:string[]=[];
      let line="";
      for(const word of words){
        const trial=line?line+" "+word:word;
        if(face.widthOfTextAtSize(trial,size)<=maxWidth){line=trial;continue;}
        if(line){lines.push(line);line="";}
        // Extremely long policy numbers and file names must never overflow a cell.
        let fragment="";
        for(const char of word){
          if(fragment&&face.widthOfTextAtSize(fragment+char,size)>maxWidth){
            lines.push(fragment);fragment=char;
          }else fragment+=char;
        }
        line=fragment;
      }
      if(line)lines.push(line);
      return lines.length?lines:[""];
    };
    const footer=()=>{
      const pageNo=pdf.getPageCount();
      page.drawLine({start:{x:margin,y:25},end:{x:pageWidth-margin,y:25},thickness:.45,color:rule});
      page.drawText("INSUREIT | System-generated claim information",{
        x:margin,y:15,size:7,font,color:rule,
      });
      const number="Page "+pageNo;
      page.drawText(number,{x:pageWidth-margin-font.widthOfTextAtSize(number,7),y:15,size:7,font,color:rule});
    };
    const nextPage=()=>{footer();page=pdf.addPage([pageWidth,pageHeight]);y=pageHeight-margin;};
    const reserve=(needed:number)=>{if(y-needed<39)nextPage();};
    const band=(label:string)=>{
      reserve(21);
      page.drawRectangle({x:margin,y:y-17,width:innerWidth,height:17,color:navy});
      page.drawText(safe(label).toUpperCase(),{x:margin+7,y:y-12,size:8.5,font:bold,color:rgb(1,1,1)});
      y-=17;
    };
    const row=(cells:{label:string;value:unknown}[])=>{
      const cellWidth=innerWidth/cells.length;
      const labelWidth=cells.length===1?110:Math.min(102,cellWidth*.42);
      const pairs=cells.map(cell=>({
        label:wrap(cell.label,labelWidth-10,7.5,bold),
        value:wrap(cell.value,cellWidth-labelWidth-12,8.1,font),
      }));
      const lineCount=Math.max(1,...pairs.map(p=>Math.max(p.label.length,p.value.length)));
      const rowHeight=Math.max(22,7+lineCount*10);
      reserve(rowHeight);
      const bottom=y-rowHeight;
      page.drawRectangle({x:margin,y:bottom,width:innerWidth,height:rowHeight,borderColor:rule,borderWidth:.45});
      cells.forEach((_,index)=>{
        const left=margin+index*cellWidth;
        if(index)page.drawLine({start:{x:left,y:bottom},end:{x:left,y},thickness:.45,color:rule});
        page.drawRectangle({x:left,y:bottom,width:labelWidth,height:rowHeight,color:shade});
        page.drawLine({start:{x:left+labelWidth,y:bottom},end:{x:left+labelWidth,y},thickness:.45,color:rule});
        const pair=pairs[index];
        pair.label.forEach((text,i)=>page.drawText(text,{x:left+5,y:y-12-i*10,size:7.5,font:bold,color:ink}));
        pair.value.forEach((text,i)=>page.drawText(text,{x:left+labelWidth+6,y:y-12-i*10,size:8.1,font,color:ink}));
      });
      y=bottom;
    };
    const pair=(a:string,av:unknown,b:string,bv:unknown)=>row([{label:a,value:av},{label:b,value:bv}]);
    const human=(key:string)=>key.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()).replace(/\bDo\b/g,"DO").replace(/\bRi\b/g,"RI");
    const excluded=new Set(["external_policy_id","insurance_company_id","insurer_id","policy_id","claim_id","customer_id","account_id","user_id","recorded_by","created_by","updated_by","spot_intimation_at","accident_at","incident_at","accident_location","location","policy_no","policy_number","vehicle_no","registration_no"]);
    const seen=new Set<string>();
    const displayEntries=milestones.flatMap(m=>Object.entries(m.details||{}).filter(([key,value])=>{
      const lower=key.toLowerCase();
      if(excluded.has(lower)||lower.endsWith("_id")||lower.endsWith("_uuid")||value===null||value==="")return false;
      if(!["string","number","boolean"].includes(typeof value))return false;
      // The same key can be repeated by historical milestone snapshots.
      if(seen.has(lower))return false;
      seen.add(lower);return true;
    }).map(([key,value])=>({label:human(key),value})));
    // Formal schedule-style header; no stage-by-stage chronology or decorative cards.
    page.drawRectangle({x:margin,y:y-42,width:innerWidth,height:42,color:navy});
    page.drawText("insureit",{x:margin+11,y:y-20,size:20,font:bold,color:rgb(1,1,1)});
    page.drawText("YOUR SAFETY, OUR PROMISE",{x:margin+11,y:y-31,size:5.5,font:bold,color:rgb(.86,.9,.97)});
    page.drawText("MOTOR INSURANCE CLAIM FORM",{x:margin+190,y:y-19,size:11,font:bold,color:rgb(1,1,1)});
    page.drawText("Claim particulars | Customer copy",{x:margin+190,y:y-31,size:8,font,color:rgb(.86,.9,.97)});
    y-=48;

    band("Claim and Policy Details");
    pair("Control No.",claim.claim_no,"Insurer Claim No.",claim.insurer_claim_no);
    pair("Claim Type",isExternalCustomerClaim(claim)?"External":"Internal","Claim Status",claim.current_status);
    row([{label:"Insurance Company",value:claim.insurer_name}]);
    row([{label:"Policy Number",value:claim.policy_no}]);

    band("Vehicle Particulars");
    pair("Registration No.",claim.vehicle_no,"Vehicle Make",claim.vehicle_make);
    row([{label:"Model",value:claim.vehicle_model}]);

    band("Accident and Claim Particulars");
    pair("Accident Date / Time",claim.accident_at,"Spot Intimation",claim.spot_intimation_at);
    row([{label:"Accident Location",value:claim.accident_location}]);

    // Organize actual saved milestone fields in one compact set of particulars,
    // without rendering each of the nine workflow stages as its own section.
    const entries=displayEntries;
    if(entries.length){
      band("Additional Claim Particulars");
      for(let index=0;index<entries.length;index+=2){
        const current=entries[index],next=entries[index+1];
        if(next)pair(current.label,current.value,next.label,next.value);
        else row([current]);
      }
    }
    band("Documents Submitted");
    if(!documents.length)row([{label:"Documents",value:"No documents recorded"}]);
    else{
      const grouped=new Map<string,number>();
      for(const doc of documents){
        const label=doc.document_type||"Other Document";
        grouped.set(label,(grouped.get(label)||0)+1);
      }
      const items=[...grouped.entries()].map(([label,count])=>({label,value:count+" uploaded"}));
      for(let index=0;index<items.length;index+=2){
        const first=items[index],second=items[index+1];
        if(second)pair(first.label,first.value,second.label,second.value);
        else row([first]);
      }
    }
    footer();
    const bytes=await pdf.save();
    return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":new URL(request.url).searchParams.get("preview")==="1" ? 'inline; filename="claim-form.pdf"' : 'attachment; filename="claim-form.pdf"',"Cache-Control":"private, no-store"}});
  }catch{return NextResponse.json({error:"Unable to generate claim details PDF"},{status:404});}
}
