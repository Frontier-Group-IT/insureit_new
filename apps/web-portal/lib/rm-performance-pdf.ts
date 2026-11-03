import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { RmPerformanceData, RmPerformanceRow, RmPerformanceQuery } from "@/lib/rm-performance";
import { loadRmPerformance } from "@/lib/rm-performance";
import { loadFinanceReport } from "@/lib/reports/finance";

type Profile = { id:string;role:string|null };
const ink = rgb(0.10,0.20,0.35);
const muted = rgb(0.39,0.46,0.57);
const line = rgb(0.86,0.89,0.93);
const cream = rgb(0.96,0.98,1);
const paperWidth=842, paperHeight=595;
const money = (n:number) => "INR "+Math.round(n).toLocaleString("en-IN");
const safe = (s:string) => s.normalize("NFKD").replace(/[^\x20-\x7E]/g," ").replace(/\s+/g," ").trim();
const label = (v:unknown) => safe(String(v ?? ""));
type Row = {name:string;tp:number;tn:number;pp:number;pn:number;indent?:number;kind?:string};
export async function loadRmReport(profile:Profile,query:RmPerformanceQuery) {
  const data=await loadRmPerformance(profile,query);
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const rm=data.selectedRmId??undefined;
  const finance=profile.role==="backoffice_executive" ? null : await Promise.all([
    loadFinanceReport(profile,{period:"custom",from:today,to:today,rm,page:"1",pageSize:"5000"}),
    loadFinanceReport(profile,{period:"custom",from:data.period.from,to:data.period.to,rm,page:"1",pageSize:"5000"}),
  ]);
  return {data,finance,today};
}
function flatten(rows:RmPerformanceRow[], selected:boolean):Row[] {
  const byId=new Map(rows.filter(x=>x.employeeId).map(x=>[x.employeeId!,x]));
  const children=new Map<string,RmPerformanceRow[]>();
  for(const r of rows){if(r.managerId&&byId.has(r.managerId)&&r.managerId!==r.employeeId) children.set(r.managerId,[...(children.get(r.managerId)??[]),r]);}
  const result:Row[]=[];
  const visited=new Set<string>();
  function walk(r:RmPerformanceRow,depth:number):{tp:number;tn:number;pp:number;pn:number} {
    const id=r.employeeId??r.name;
    if(visited.has(id))return {tp:0,tn:0,pp:0,pn:0};
    visited.add(id);
    const own={tp:r.todayPolicies,tn:r.todayNetPremium,pp:r.mtdPolicies,pn:r.mtdNetPremium};
    const heading:Row={name:r.name,tp:0,tn:0,pp:0,pn:0,indent:Math.min(depth,3),kind:"head"};
    result.push(heading);
    result.push({name:"Direct Partners (own business)",...own,indent:Math.min(depth+1,4),kind:"own"});
    for(const src of r.sources) result.push({name:src.label,tp:src.todayPolicies,tn:src.todayNetPremium,pp:src.mtdPolicies,pn:src.mtdNetPremium,indent:Math.min(depth+2,5),kind:"source"});
    const total={...own};
    for(const child of children.get(id)??[]){
      const sub=walk(child,depth+1);
      total.tp+=sub.tp; total.tn+=sub.tn; total.pp+=sub.pp; total.pn+=sub.pn;
    }
    Object.assign(heading,total);
    return total;
  }
  for(const r of rows)if(selected||!r.managerId||!byId.has(r.managerId)||r.managerId===r.employeeId)walk(r,0);
  for(const r of rows)if(!visited.has(r.employeeId??r.name))walk(r,0);
  return result;
}
export async function buildRmPerformancePdf(profile:Profile, query:RmPerformanceQuery):Promise<{bytes:Uint8Array;filename:string;period:string}> {
  const {data,finance,today}=await loadRmReport(profile,query);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  let page=pdf.addPage([paperWidth,paperHeight]);
  let y=paperHeight-44;
  let pageNumber=1;
  const text=(value:string,x:number,yy:number,size=10,b=false,color=ink,maxWidth?:number)=>{
    const f=b?bold:font;
    let valueToDraw=safe(value);
    if(maxWidth){while(valueToDraw.length>2&&f.widthOfTextAtSize(valueToDraw,size)>maxWidth)valueToDraw=valueToDraw.slice(0,-2);if(valueToDraw!==safe(value))valueToDraw+="...";}
    page.drawText(valueToDraw,{x,y:yy,size,font:f,color});
  };
  function header(){
    page.drawRectangle({x:0,y:paperHeight-82,width:paperWidth,height:82,color:ink});
    page.drawText("INSUREIT",{x:38,y:paperHeight-39,size:19,font:bold,color:rgb(1,1,1)});
    page.drawText("RM BUSINESS PERFORMANCE REPORT",{x:38,y:paperHeight-59,size:9,font,color:rgb(.85,.91,1)});
    page.drawText(safe(today+"  |  "+data.period.shortLabel),{x:530,y:paperHeight-42,size:10,font:bold,color:rgb(1,1,1)});
    page.drawText(safe(data.period.from+" to "+data.period.to),{x:530,y:paperHeight-59,size:9,font,color:rgb(.85,.91,1)});
    page.drawText("Page "+pageNumber,{x:750,y:25,size:9,font,color:muted});
    y=paperHeight-104;
  }
  function newPage(){page=pdf.addPage([paperWidth,paperHeight]);pageNumber++;header();}
  function ensure(h:number){if(y-h<40)newPage();}
  function heading(title:string){ensure(35);text(title,38,y-4,12,true);y-=27;page.drawLine({start:{x:38,y},end:{x:804,y},thickness:.6,color:line});y-=12;}
  function pairRow(name:string,todayCount:number,todayPremium:number,periodCount:number,periodPremium:number,accent=false,indent=0){
    ensure(24);
    if(accent)page.drawRectangle({x:38,y:y-14,width:766,height:24,color:cream});
    const c=accent?ink:muted;
    text(name,42+Math.min(indent,5)*12,y-5,9,accent,c,240-Math.min(indent,5)*12);
    text(String(todayCount),365,y-5,9,accent);
    text(money(todayPremium),435,y-5,9,accent,110);
    text(String(periodCount),584,y-5,9,accent);
    text(money(periodPremium),659,y-5,9,accent,135);
    y-=24;
  }
  function tableHeader(){
    ensure(46);
    page.drawRectangle({x:38,y:y-21,width:766,height:36,color:ink});
    text("RM / Source",45,y-6,9,true,rgb(1,1,1));
    text("TODAY",392,y+5,9,true,rgb(1,1,1));
    text(data.period.shortLabel.toUpperCase(),625,y+5,9,true,rgb(1,1,1),160);
    text("Policies",360,y-13,8,false,rgb(1,1,1));text("Net Premium",433,y-13,8,false,rgb(1,1,1));
    text("Policies",579,y-13,8,false,rgb(1,1,1));text("Net Premium",655,y-13,8,false,rgb(1,1,1));
    y-=34;
  }
  header();
  text("Scope: "+(data.selectedRmName??"All RMs"),38,y,10,true);y-=24;
  heading("Business Summary - Today and "+data.period.shortLabel);
  tableHeader();
  pairRow("Total policies / Net Premium",data.today.policy_count,data.today.net_premium,data.mtd.policy_count,data.mtd.net_premium,true);
  pairRow("Motor",data.today.motor_policy_count,data.today.motor_net_premium,data.mtd.motor_policy_count,data.mtd.motor_net_premium);
  pairRow("Non-Motor",data.today.non_motor_policy_count,data.today.non_motor_net_premium,data.mtd.non_motor_policy_count,data.mtd.non_motor_net_premium);
  pairRow("Life",data.todayBusinessLineCounts.life,data.todayBusinessLinePremium.life,data.mtdBusinessLineCounts.life,data.mtdBusinessLinePremium.life);
  pairRow("Health",data.todayBusinessLineCounts.health,data.todayBusinessLinePremium.health,data.mtdBusinessLineCounts.health,data.mtdBusinessLinePremium.health);
  if(finance){
    const a=finance[0].report.summary,b=finance[1].report.summary;
    pairRow("Projected Pay-in after TDS",0,a.payin_after_tds??0,0,b.payin_after_tds??0);
    pairRow("Projected Payout",0,a.gross_payout??0,0,b.gross_payout??0);
    pairRow("Retention",0,(a.payin_after_tds??0)-(a.gross_payout??0),0,(b.payin_after_tds??0)-(b.gross_payout??0));
  }
  y-=16;
  heading("RM-wise Performance and Direct Partners");
  tableHeader();
  const flattened=flatten(data.rows,Boolean(data.selectedRmId));
  if(!flattened.length) pairRow("No RM production in selected scope",0,0,0,0);
  for(const r of flattened){
    if(y<65){newPage();tableHeader();}
    pairRow(r.name,r.tp,r.tn,r.pp,r.pn,r.kind==="head",r.indent??0);
  }
  y-=14;
  heading("Recent Monthly Business Trend");
  ensure(30);
  text("Period",45,y,9,true);text("Policies",365,y,9,true);text("Net Premium",520,y,9,true);y-=22;
  for(const point of data.ytdTrend){
    ensure(22);
    const item=point as unknown as Record<string,unknown>;
    text(label(item.month??item.label??item.period??""),45,y,9);
    text(label(item.policy_count??item.policies??""),365,y,9);
    text(money(Number(item.net_premium??0)),520,y,9);
    y-=21;
  }
  return {bytes:await pdf.save(),filename:"insureit-rm-business-"+today+"-"+data.period.key+".pdf",period:data.period.shortLabel};
}
