import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type RGB } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import type { RmPerformanceRow, RmPerformanceQuery } from "@/lib/rm-performance";
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

const white=rgb(1,1,1);
const navy=rgb(0.10,0.20,0.35);
const soft=rgb(0.96,0.98,1);
const secondary=rgb(0.36,0.43,0.54);
const pageLeft=38;
const pageRight=804;

function rupee(page:PDFPage,x:number,y:number,size:number,color:RGB) {
  // Standard PDF Helvetica lacks U+20B9; draw a compact vector rupee mark.
  const h=size*0.88,w=size*0.65,thickness=Math.max(.65,size*.08);
  const stroke=(ax:number,ay:number,bx:number,by:number)=>page.drawLine({start:{x:ax,y:ay},end:{x:bx,y:by},color,thickness});
  stroke(x,y+h,x+w,y+h);stroke(x,y+h*.75,x+w,y+h*.75);
  stroke(x+w*.37,y+h,x+w*.46,y+h*.75);
  stroke(x+w*.46,y+h*.75,x+w*.38,y+h*.40);
  stroke(x+w*.38,y+h*.40,x,y+h*.40);
  stroke(x,y+h*.40,x+w*.62,y);
  return w+size*.20;
}
export async function buildRmPerformancePdf(profile:Profile,query:RmPerformanceQuery):Promise<{bytes:Uint8Array;filename:string;period:string}> {
  const {data,finance,today}=await loadRmReport(profile,query);
  const pdf=await PDFDocument.create();
  const font=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  // Reuse the canonical portal INSUREIT shield, not a substitute icon.
  // Convert WebP to PNG once; PDF-lib does not support direct WebP embedding.
  const markFile=join(process.cwd(),"public","assets","brand","insureit-mark.webp");
  const markPng=await sharp(await readFile(markFile)).png().toBuffer();
  const mark=await pdf.embedPng(markPng);
  const paperWidth=842,paperHeight=595;
  let page=pdf.addPage([paperWidth,paperHeight]);
  let pageNumber=1;
  let y=paperHeight-105;
  const dateLabel=(iso:string)=>new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(iso+"T00:00:00Z"));
  const periodLabel=data.period.key==="mtd"?"MONTH TO DATE":data.period.key==="last_month"?"LAST MONTH":"CUSTOM PERIOD";
  const moneyLabel=(n:number)=>"₹"+Math.round(n).toLocaleString("en-IN");
  const formattedToday=dateLabel(today);
  const renderedPeriod=data.period.key==="mtd"?"MTD":data.period.shortLabel;
  function paint(value:string,x:number,yy:number,size=9,b=false,color:RGB=navy,maxWidth?:number){
    const face:PDFFont=b?bold:font;
    const segments=value.split("₹");
    let advance=x;
    for(let i=0;i<segments.length;i++){
      if(i>0) advance+=rupee(page,advance,yy,size,color);
      const chunk=safe(segments[i]);
      if(!chunk)continue;
      let drawn=chunk;
      if(maxWidth){
        const remaining=Math.max(0,maxWidth-(advance-x));
        while(drawn.length>1&&face.widthOfTextAtSize(drawn,size)>remaining)drawn=drawn.slice(0,-1);
        if(face.widthOfTextAtSize(drawn,size)>remaining)break;
      }
      page.drawText(drawn,{x:advance,y:yy,font:face,size,color});
      advance+=face.widthOfTextAtSize(drawn,size);
    }
  }
  function header(){
    page.drawRectangle({x:0,y:paperHeight-86,width:paperWidth,height:86,color:navy});
    // Square logo mount preserves the original mark aspect ratio.
    page.drawRectangle({x:38,y:paperHeight-67,width:49,height:49,color:white});
    const scale=Math.min(43/mark.width,43/mark.height);
    const mw=mark.width*scale,mh=mark.height*scale;
    page.drawImage(mark,{x:38+(49-mw)/2,y:paperHeight-67+(49-mh)/2,width:mw,height:mh});
    paint("INSUREIT",99,paperHeight-40,19,true,white);
    paint("RM BUSINESS PERFORMANCE REPORT",99,paperHeight-60,9,false,rgb(.85,.91,1));
    paint(formattedToday+"  |  "+renderedPeriod,599,paperHeight-40,10,true,white,205);
    paint(dateLabel(data.period.from)+" - "+dateLabel(data.period.to),599,paperHeight-59,9,false,rgb(.85,.91,1),205);
    paint("INSUREIT  •  RM Business Performance  |  Page "+pageNumber,38,20,8,false,secondary);
    y=paperHeight-108;
  }
  function nextPage(){page=pdf.addPage([paperWidth,paperHeight]);pageNumber++;header();}
  function ensureSpace(height:number){if(y-height<43)nextPage();}
  function sectionHeading(title:string){
    ensureSpace(34);
    paint(title,pageLeft,y-5,12,true);
    y-=24;
    page.drawLine({start:{x:pageLeft,y},end:{x:pageRight,y},thickness:.6,color:line});
    y-=13;
  }
  function summaryCard(x:number,top:number,width:number,title:string,
    summary:typeof data.today,lifeCount:number,healthCount:number,lifePremium:number,healthPremium:number,
    payin:number,payout:number){
    const height=181,bottom=top-height;
    page.drawRectangle({x,y:bottom,width,height,borderColor:line,borderWidth:.8,color:white});
    paint(title,x+15,top-20,9,true,secondary);
    paint(moneyLabel(summary.net_premium),x+15,top-51,21,true,navy,width-45);
    paint("Net Premium",x+15,top-67,8,false,secondary);
    paint(String(summary.policy_count)+" Policies",x+width-106,top-67,10,true,navy,92);
    page.drawLine({start:{x:x+15,y:top-78},end:{x:x+width-15,y:top-78},color:line,thickness:.6});
    const categories=[
      ["Motor",summary.motor_policy_count,summary.motor_net_premium],
      ["Non-Motor",summary.non_motor_policy_count,summary.non_motor_net_premium],
      ["Life",lifeCount,lifePremium],
      ["Health",healthCount,healthPremium],
    ] as const;
    const rowY=top-94;
    categories.forEach(([name,count,amount],i)=>{
      const col=i%2, row=Math.floor(i/2),start=x+15+col*(width-30)/2;
      paint(name,start,rowY-row*18,8,false,secondary,62);
      paint(String(count),start+67,rowY-row*18,8,true,navy,25);
      paint(moneyLabel(amount),start+98,rowY-row*18,8,true,navy,79);
    });
    page.drawLine({start:{x:x+15,y:top-127},end:{x:x+width-15,y:top-127},color:line,thickness:.6});
    const remaining=[
      ["Proj. Pay-in",payin],
      ["Proj. Payout",payout],
      ["Retention",payin-payout],
    ] as const;
    remaining.forEach(([name,amount],i)=>{
      const col=i%3;const cell=(width-30)/3;const cx=x+15+col*cell;
      paint(name,cx,top-145,8,false,secondary,cell-5);
      paint(moneyLabel(amount),cx,top-163,10,true,navy,cell-5);
    });
  }
  function row(name:string,todayCount:number,todayNet:number,periodCount:number,periodNet:number,accent=false,depth=0){
    ensureSpace(22);
    if(accent)page.drawRectangle({x:pageLeft,y:y-13,width:766,height:22,color:soft});
    paint(name,44+Math.min(depth,5)*11,y-5,8.6,accent,accent?navy:secondary,244-Math.min(depth,5)*11);
    paint(String(todayCount),350,y-5,8.6,accent);
    paint(moneyLabel(todayNet),429,y-5,8.6,accent,navy,125);
    paint(String(periodCount),573,y-5,8.6,accent);
    paint(moneyLabel(periodNet),657,y-5,8.6,accent,navy,135);
    y-=22;
  }
  function tableHeading(){
    ensureSpace(46);
    page.drawRectangle({x:pageLeft,y:y-23,width:766,height:38,color:navy});
    paint("RM / SOURCE",45,y-8,9,true,white);
    paint("TODAY",397,y+4,9,true,white);
    paint(renderedPeriod.toUpperCase(),612,y+4,9,true,white,175);
    paint("Policies",345,y-15,8,false,white);
    paint("Net Premium",426,y-15,8,false,white);
    paint("Policies",568,y-15,8,false,white);
    paint("Net Premium",654,y-15,8,false,white);
    y-=40;
  }
  header();
  paint("Scope: "+(data.selectedRmName??"All RMs"),pageLeft,y,10,true);
  y-=21;
  const cardTop=y;
  const todayFinance=finance?.[0].report.summary;
  const periodFinance=finance?.[1].report.summary;
  summaryCard(38,cardTop,373,"TODAY",data.today,
    data.todayBusinessLineCounts.life,data.todayBusinessLineCounts.health,
    data.todayBusinessLinePremium.life,data.todayBusinessLinePremium.health,
    todayFinance?.payin_after_tds??0,todayFinance?.gross_payout??0);
  summaryCard(429,cardTop,373,periodLabel,data.mtd,
    data.mtdBusinessLineCounts.life,data.mtdBusinessLineCounts.health,
    data.mtdBusinessLinePremium.life,data.mtdBusinessLinePremium.health,
    periodFinance?.payin_after_tds??0,periodFinance?.gross_payout??0);
  y=cardTop-194;
  paint("* Projected pay-in is after TDS.",pageLeft,y,8,false,secondary);y-=22;
  sectionHeading("RM-wise Performance & Direct Partners");
  tableHeading();
  const rows=flatten(data.rows,Boolean(data.selectedRmId));
  if(!rows.length)row("No RM production in selected scope",0,0,0,0);
  for(const item of rows){
    if(y<72){nextPage();tableHeading();}
    row(item.name,item.tp,item.tn,item.pp,item.pn,item.kind==="head",item.indent??0);
  }
  // The reference specifically excludes the MTD Context graph and trend section.
  return {
    bytes:await pdf.save(),
    filename:"insureit-rm-business-"+today+"-"+data.period.key+".pdf",
    period:data.period.shortLabel,
  };
}
