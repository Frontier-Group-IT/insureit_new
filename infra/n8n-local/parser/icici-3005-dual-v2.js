
const raw = String($input.first().json.text || $input.first().json.data || '').replace(/\r/g,'\n').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ');

function normalizeOdPdfText(input) {
  let raw = String(input || '').replace(/\r/g, '\n').replace(/\u00a0/g, ' ');
  const block = (begin, end) => {
    const a=raw.indexOf(begin); if(a<0)return '';
    const b=raw.indexOf(end,a+begin.length);
    return raw.slice(a+begin.length,b>a?b:undefined);
  };
  const labeled = (part, names) => {
    const lines=part.split('\n').map(s=>s.trim()).filter(Boolean);
    if(lines.length < names.length*2)return [];
    const labels=lines.slice(0,names.length);
    if(!names.every((n,i)=>labels[i].toLowerCase()===n.toLowerCase()))return [];
    return lines.slice(names.length,names.length*2);
  };
  const vehicleNames=['Name of the Insured','Period of Insurance - Own Damage','Vehicle Make / Model','RTO City','Vehicle Registration No.','Vehicle Registration Date','Engine No.','Chassis No.','Current Year NCB(%)'];
  const vehicleBlock=block('Insured & Vehicle Details','Previous Policy Details');
  // OD layouts without Current Year NCB have only eight printed labels.
  const nine=labeled(vehicleBlock,vehicleNames);
  const v=nine.length===vehicleNames.length?nine:labeled(vehicleBlock,vehicleNames.slice(0,-1));
  const tpNames=['Third Party Policy No.','Third Party Period of Insurance','Third Party Insurer Name'];
  const tp=labeled(block('Third Party Insurance Details','The commencement'),tpNames);
  const canonical=[];
  if(v.length>=vehicleNames.length-1)v.forEach((value,i)=>canonical.push(vehicleNames[i]+'     '+value));
  if(tp.length===tpNames.length)tp.forEach((value,i)=>canonical.push(tpNames[i]+'     '+value));
  const issued=raw.match(/Policy Issued On\s*\n\s*:\s*\n\s*([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})/i);
  if(issued)canonical.push('Policy Issued On : '+issued[1]);
  raw=canonical.join('\n')+'\n'+raw;
  const premMatch=raw.match(/Premium Details\s*\n([\s\S]*?)(?=Unique Identification Number \(UIN\) Details)/i);
  if(premMatch){
    const part=premMatch[1];
    const m=part.match(/Basic OD Premium\s*\n([\s\S]*?)\nSub Total\s*\nLess:\s*\nNo Claim Bonus\s*([\d.]+)%\s*\nSub-Total Deductions\s*\n((?:[\d,]+\.\d{2}\s*\n){4,})/i);
    if(m){
      const addonLabels=m[1].trim().split('\n').map(s=>s.trim()).filter(Boolean);
      const numbers=(m[3].match(/[\d,]+\.\d{2}/g)||[]);
      if(numbers.length===addonLabels.length+4){
        const first=Number(numbers[0].replace(/,/g,''));
        const subtotal=Number(numbers[1+addonLabels.length].replace(/,/g,''));
        const deduct=Number(numbers[2+addonLabels.length].replace(/,/g,''));
        if(Math.abs(first+addonLabels.reduce((s,_,i)=>s+Number(numbers[i+1].replace(/,/g,'')),0)-subtotal)<0.01 &&
           deduct===Number(numbers[3+addonLabels.length].replace(/,/g,''))){
          const formatted=['Basic OD Premium       '+numbers[0],...addonLabels.map((x,i)=>x+'       '+numbers[i+1]),'Sub Total       '+numbers[1+addonLabels.length],'No Claim Bonus '+m[2]+'%       '+numbers[2+addonLabels.length],'Sub-Total Deductions       '+numbers[3+addonLabels.length]];
          const start=part.indexOf('Basic OD Premium');
          const end=part.indexOf('Total Own Damage Premium(A)');
          if(start>=0&&end>start){
            const replacement=part.slice(0,start)+formatted.join('\n')+'\n'+part.slice(end);
            raw=raw.replace(premMatch[0],'Premium Details\n'+replacement);
          }
        }
      }
    }
  }
  return raw;
}

// Review-only ICICI Lombard 3005/O parser for an n8n Code node.
// Native PDF text only; no OCR fallback, remote calls, or DB writes.
function parseIcici3005Od(text) {
  const raw=normalizeOdPdfText(String(text||"").replace(/\r/g,"\n").replace(/\u00a0/g," "));
  const match=(rx,n=1)=>String(raw.match(rx)?.[n]||"").trim();
  const money=x=>Number(String(x).replace(/,/g,""));
  const dt=x=>{
    const m=String(x||"").match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(20\d{2})/);
    const i=m?["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"].indexOf(m[1].toUpperCase()):-1;
    return i>=0?m[3]+"-"+String(i+1).padStart(2,"0")+"-"+m[2].padStart(2,"0"):null;
  };
  const period=(rx)=>{
    const m=raw.match(rx);
    return m?[dt(m[1]),dt(m[2])]:[null,null];
  };
  const pno=match(/\b(3005\/O\/\d{7,12}\/\d{2}\/[A-Z0-9]{3})\b/i);
  const odOnly=/Product Code:\s*3005\/O\b/i.test(raw)
    && /Stand-Alone Own Damage Two wheeler Insurance Policy/i.test(raw)
    && /This Policy covers only Own Damage Risk/i.test(raw)
    && /ICICI\s+Lombard/i.test(raw);
  const insured=match(/^\s*Name of the Insured[ \t]+([^\n]+)$/im).split(/\s{3,}/)[0];
  const issued=dt(match(/Policy Issued On\s*:\s*([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})/i));
  const [os,oe]=period(/Period of Insurance\s*[-–]\s*Own Damage[^\n]*?([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})\s+to\s+([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})/i);
  const [ts,te]=period(/Third Party Period of Insurance[^\n]*?([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})\s+to\s+([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})/i);
  const tpNo=match(/^\s*Third Party Policy No\.\s+([A-Za-z0-9/.-]+)/im);
  const tpInsurer=match(/^\s*Third Party Insurer Name\s+([^\n]+)/im);
  const mm=match(/^\s*Vehicle Make\s*\/\s*Model\s+([^\n]+)/im).match(/^(.+?)\s*\/\s*(.+)$/);
  const make=mm?.[1]?.trim()||null,model=mm?.[2]?.trim()||null;
  const reg=match(/^\s*Vehicle Registration No\.\s+([A-Z0-9-]+)/im);
  const engine=match(/^\s*Engine No\.\s+([A-Z0-9]+)/im);
  const chassis=match(/^\s*Chassis No\.\s+([A-Z0-9]+)/im);
  const rto=match(/^\s*RTO City\s+([^\n]+)/im);
  const plateRow=raw.split("\n").find(x=>reg&&x.includes(reg)&&/Solo With Pillion/i.test(x))||"";
  const year=plateRow.match(/\b(20\d{2})\b/)?.[1]||null;
  const kw=plateRow.match(/Solo With Pillion\s+(\d+(?:\.\d+)?)\s+20\d{2}/i)?.[1]||null;
  const idvStart=raw.search(/\bVehicle IDV\b/i),premStart=raw.search(/\bPremium Details\b/i);
  const idvRow=idvStart>=0&&premStart>idvStart?
    raw.slice(idvStart,premStart).split("\n").find(x=>/\b[\d,]+\.\d{2}\b/.test(x))||"":"";
  const idvNumbers=(idvRow.match(/[\d,]+\.\d{2}/g)||[]).map(money);
  const idv=idvNumbers.length>=2&&idvNumbers[0]===idvNumbers.at(-1)?idvNumbers[0]:null;
  const premEnd=raw.search(/Unique Identification Number \(UIN\) Details|Geographical Area:/i);
  const prem=premStart>=0?raw.slice(premStart,premEnd>premStart?premEnd:premStart+3500):"";
  const rows=prem.split("\n").map(x=>x.trim()).filter(Boolean);
  const lineAmount=rx=>{
    const row=rows.find(x=>rx.test(x));
    const m=row?.match(/([\d,]+\.\d{2})\s*$/);
    return m?money(m[1]):null;
  };
  const first=rows.findIndex(x=>/^Basic OD Premium\b/i.test(x));
  const stop=rows.findIndex((x,i)=>i>first&&/^Sub Total\b/i.test(x));
  const entries=first>=0&&stop>first?rows.slice(first,stop).map(x=>x.match(/^(.+?)\s{2,}([\d,]+\.\d{2})\s*$/)):[];
  const validEntries=entries.length>0&&entries.every(Boolean)&&/^Basic OD Premium$/i.test(entries[0][1].trim());
  const basicOd=validEntries?money(entries[0][2]):null;
  const addons=validEntries?entries.slice(1).map(x=>({name:x[1].trim(),amount:money(x[2])})):[];
  const subtotal=lineAmount(/^Sub Total\b/i);
  const printedDeductions=lineAmount(/^Sub-Total Deductions\b/i);
  const od=lineAmount(/^Total Own Damage Premium\s*\(A\)/i);
  const printedNcbSection=/^No Claim Bonus\s+\d+(?:\.\d+)?%|^Sub-Total Deductions/im.test(prem);
  // A policy with no NCB/deduction row has zero deduction only when
  // printed subtotal and total OD agree exactly.
  const deductions=printedDeductions!==null?printedDeductions
    :(!printedNcbSection&&subtotal!==null&&od!==null&&Math.round(subtotal*100)===Math.round(od*100)?0:null);
  const tax=lineAmount(/^Total Tax Payable\b/i);
  const gross=lineAmount(/^Total Premium Payable\b/i);
  const gi=rows.findIndex(x=>/^IGST$/i.test(x)),ti=rows.findIndex(x=>/^Total Tax Payable\b/i.test(x));
  const igsts=gi>=0&&ti>gi?(rows.slice(gi+1,ti).join(" ").match(/[\d,]+\.\d{2}/g)||[]).map(money):[];
  const igst=igsts.length?igsts.at(-1):null;
  const cents=x=>Number.isFinite(x)?Math.round(x*100):null;
  const validDate=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x));
  const checks={
    is_icici_3005_od:odOnly,
    insured_name_present:insured.length>2,
    policy_number_present:Boolean(pno),
    vehicle_details_present:Boolean(make&&model&&reg&&engine&&chassis&&rto),
    dates_present:[issued,os,oe,ts,te].every(validDate)&&oe>=os&&te>=ts&&te>=oe,
    od_subtotal_reconciled:basicOd!==null&&subtotal!==null&&addons.every(a=>Number.isFinite(a.amount)&&a.amount>=0)&&cents(basicOd+addons.reduce((s,a)=>s+a.amount,0))===cents(subtotal),
    ncb_deduction_reconciled:subtotal!==null&&deductions!==null&&od!==null&&cents(subtotal-deductions)===cents(od),
    net_tax_equal_gross:od!==null&&tax!==null&&gross!==null&&cents(od+tax)===cents(gross),
    idv_present:idv!==null&&idv>0,
    manufacturing_year_present:Boolean(year),
    third_party_reference_present:Boolean(tpNo&&tpInsurer&&ts&&te),
    zero_tp_charged:/covers only Own Damage Risk/i.test(raw)&&!/Total Liability Premium\s*\(B\)/i.test(prem),
    exact_igst_rounds_to_tax:igst!==null&&tax!==null&&Math.round(igst)===tax
  };
  const warnings=Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>"OD parser needs review: "+k);
  const fields=[];
  const add=(key,label,value,page,evidence)=>{
    if(value!==null&&value!==undefined&&String(value).trim()!=="")
      fields.push({key,label,value:String(value),confidence:null,page,evidence});
  };
  add("policy_number","Policy number",pno,1,"Policy No.");
  add("insurer_name","Insurer","ICICI Lombard General Insurance Company Limited",1,"ICICI Lombard heading");
  add("policy_product","Product","Stand-Alone Own Damage",3,"Stand-Alone Own Damage Two wheeler Insurance Policy");
  add("policy_issuance_date","Issued on",issued,3,"Policy Issued On");
  add("policy_start_date","OD start",os,1,"Period of Insurance - Own Damage");
  add("policy_end_date","OD end",oe,1,"Period of Insurance - Own Damage");
  add("third_party_start_date","TP reference start",ts,1,"Third Party Period of Insurance");
  add("third_party_end_date","TP reference end",te,1,"Third Party Period of Insurance");
  add("third_party_policy_number","TP reference policy",tpNo,1,"Third Party Policy No.");
  add("third_party_insurer_name","TP reference insurer",tpInsurer,1,"Third Party Insurer Name");
  add("insured_name","Insured name",insured,1,"Name of the Insured");
  add("vehicle_make","Make",make,1,"Vehicle Make / Model");
  add("vehicle_model","Model",model,1,"Vehicle Make / Model");
  add("vehicle_class","Class","Two Wheeler",3,"Stand-Alone Own Damage Two wheeler Insurance Policy");
  if(kw)add("vehicle_fuel_type","Fuel","Electric",3,"CC/KW");
  if(kw)add("vehicle_motor_power_kw","Motor kW",kw,3,"CC/KW");
  add("vehicle_registration_number","Registration",reg,1,"Vehicle Registration No.");
  add("vehicle_engine_number","Engine",engine,1,"Engine No.");
  add("vehicle_chassis_number","Chassis",chassis,1,"Chassis No.");
  add("vehicle_manufacturing_year","Mfg year",year,3,"Mfg Yr");
  add("vehicle_rto_name","RTO",rto,1,"RTO City");
  if(rto.includes("-"))add("vehicle_rto_state","RTO state",rto.split("-")[0].trim(),1,"RTO City");
  add("idv","IDV",idv,3,"Vehicle IDV");
  add("od_premium","OD premium",od,3,"Total Own Damage Premium(A)");
  add("tp_premium","TP charged",0,3,"Own Damage Risk only");
  add("cpa_premium","CPA charged",0,3,"Own Damage Risk only");
  const valid=Object.values(checks).every(Boolean);
  return {validation_passed:valid,review_required:true,checks,warnings,
    insureit_proposal:valid?fields:[],parser_id:"icici_3005_od_n8n_native_pdf",parser_version:"bridge-od-v1",
    premium_components:{basic_od_premium:basicOd,od_addons:addons,printed_od_subtotal:subtotal,od_deductions:deductions,
      total_od_premium:od,basic_tp_premium:0,owner_driver_cpa:0,total_liability_premium:0,
      net_premium:od,igst_exact:igst,printed_total_tax:tax,gross_premium:gross}
  };
}

const recognizedOd=/\bProduct\s+Code\s*:\s*3005\/O\b/i.test(raw);
const recognizedBundled=/\bProduct\s+Code\s*:\s*3005\b(?!\s*\/)/i.test(raw);
if(recognizedOd) return [{json:parseIcici3005Od($input.first().json.text || $input.first().json.data || '')}];
if(!recognizedBundled) return [{json:{
  validation_passed:false,review_required:true,parser_id:'icici_policy_unrecognized_native_pdf',
  parser_version:'bridge-dispatch-v1',checks:{recognized_icici_product:false},
  warnings:['Policy product code not recognized; manual review required'],
  insureit_proposal:[],premium_components:{}
}}];
const warnings=[];
const first=(s,re)=>{ const m=s.match(re); return m ? String(m[1]||'').trim() : null; };
const money=x=> x == null ? null : Number(String(x).replace(/,/g,''));
const amount=(s,label)=> money(first(s,new RegExp(label+'[^\\d]{0,35}([\\d,]+\\.\\d{2})','i')));
const date=d=>{const m=String(d||'').match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(20\d{2})/);if(!m)return null;const ix=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].indexOf(m[1].toUpperCase());return ix<0?null:m[3]+'-'+String(ix+1).padStart(2,'0')+'-'+m[2].padStart(2,'0');};
const insIdx=raw.indexOf('Insured & Vehicle Details');
const insEnd=raw.indexOf('The commencement',insIdx+1);
const section=insIdx>=0&&insEnd>insIdx?raw.slice(insIdx,insEnd):'';
const lines=section.split('\n').map(x=>x.trim()).filter(Boolean);
const labels=['Name of Insured','Period of Insurance - Own Damage','Period of Insurance - Third Party','Vehicle Make / Model','RTO City','Vehicle Registration No.','Vehicle Registration Date','Engine No.','Chassis No.'];
const columnOrder=labels.every((label,i)=>String(lines[i+1]||'').toLowerCase()===label.toLowerCase());
const cols=columnOrder&&lines.length>=19?lines.slice(10,19):[];
const insurer=/ICICI\s+LOMBARD/i.test(raw)?'ICICI Lombard General Insurance Company Limited':null;
const policy_number=first(raw,/\bPolicy\s+No\.?\s*:?\s*(\d{4}\/\d+\/\d{2}\/\d{3})\b/i);
const product_code=first(raw,/Product Code\s*:\s*(\d{4})\b/i);
const product=product_code==='3005'?'Bundled Two Wheeler Policy':null;
const inlineName=first(raw,/Name of (?:the )?Insured[ \t]*:?\s*([A-Z][A-Z .'-]{2,70})(?=\n|\r)/i);
const insured_name=cols[0]||(inlineName&&!/^Period of Insurance/i.test(inlineName)?inlineName:null);
const inlineOd=raw.match(/Period of Insurance\s*[-–]\s*Own Damage\s*:?\s*([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})\s*(?:\d{1,2}:\d{2}\s*)?to\s*(?:Midnight of\s*)?([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})/i);
const inlineTp=raw.match(/Period of Insurance\s*[-–]\s*Third Party\s*:?\s*([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})\s*(?:\d{1,2}:\d{2}\s*)?to\s*(?:Midnight of\s*)?([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})/i);
const odDates=cols[1]?cols[1].split(/ to /i):inlineOd?[inlineOd[1],inlineOd[2]]:[];
const tpDates=cols[2]?cols[2].split(/ to /i):inlineTp?[inlineTp[1],inlineTp[2]]:[];
const inlineModel=raw.match(/Vehicle Make\s*\/\s*Model[ \t]*([A-Za-z0-9 &.-]{2,45})\s*\/\s*([A-Za-z0-9 &.-]{2,45})(?=\n|\r)/i);
const modelMatch=cols[3]?cols[3].match(/^([A-Za-z0-9 &.-]+)\s*\/\s*([A-Za-z0-9 &.-]+)$/):inlineModel;
const registration_no=cols[5]||first(raw,/Vehicle Registration No\.?[ \t]*:?\s*([A-Z0-9-]{2,22})(?=\n|\r)/i);
const rto_city=cols[4]||first(raw,/RTO City[ \t]*:?\s*([^\n\r]{4,80})/i);
const engine_no=cols[7]||first(raw,/\bEngine No\.?[ \t]*:?\s*([A-Z0-9]{6,22})(?=\n|\r)/i);
const chassis_no=cols[8]||first(raw,/\bChassis No\.?[ \t]*:?\s*([A-Z0-9]{12,22})(?=\n|\r)/i);
const vehStart=raw.search(/Vehicle Registration\s+No\./i);
const vehEnd=raw.search(/\bPremium Details\b/i);
const veh=vehStart>=0&&vehEnd>vehStart?raw.slice(vehStart,vehEnd):'';
const year=first(veh,/\bMfg Yr\b[\s\S]{15,220}?\b(20\d{2})\b/i);
const idvRegion=veh.includes('Total IDV')?veh.slice(veh.indexOf('Total IDV')):'';
const idvNums=(idvRegion.match(/\b[\d,]+\.\d{2}\b/g)||[]).map(money).filter(x=>x>0);
const idv=idvNums.length&&idvNums[0]===idvNums[idvNums.length-1]?idvNums[0]:null;
if(idv===null)warnings.push('IDV needs manual confirmation');
const pstart=raw.search(/\bPremium Details\b/i), pend=raw.search(/\bGeographical Area\b/i);
const p=pstart>=0?raw.slice(pstart,pend>pstart?pend:pstart+1400):'';
const od=amount(p,'Total Own Damage Premium\\s*\\(A\\)');
const liability=amount(p,'Total Liability Premium\\s*\\(B\\)');
const net=amount(p,'Total Package Premium\\s*\\(A\\s*\\+\\s*B\\)');
const tax=amount(p,'Total Tax Payable');
const gross=amount(p,'Total Premium Payable');
const pa=p.search(/PA Cover for Owner Driver/i), odEnd=p.search(/Total Own Damage Premium/i);
let cpa=null;
if(pa>=0&&odEnd>pa){const vals=(p.slice(pa,odEnd).match(/\b[\d,]+\.\d{2}\b/g)||[]).map(money);if(vals.length>=2&&vals.at(-1)===vals.at(-2))cpa=vals.at(-1);}
const tp=liability!==null&&cpa!==null&&liability>=cpa?Math.round((liability-cpa)*100)/100:null;
if(cpa===null)warnings.push('CPA/TP split could not be safely confirmed');
const fields={
  insurer, product, product_code, insured_name, policy_number,
  own_damage_start:date(odDates[0]),own_damage_end:date(odDates[1]),
  third_party_start:date(tpDates[0]),third_party_end:date(tpDates[1]),
  vehicle_make:modelMatch?modelMatch[1].trim():null,vehicle_model:modelMatch?modelMatch[2].trim():null,
  vehicle_registration:registration_no,rto_city,vehicle_engine_number:engine_no,vehicle_chassis_number:chassis_no,
  manufacturing_year:year,idv,od_premium:od,tp_premium:tp,cpa_premium:cpa,
  total_liability_premium:liability,net_premium:net,total_tax:tax,gross_premium:gross
};
const checks={
  is_icici_3005:Boolean(insurer&&product_code==='3005'),
  insured_name_present:Boolean(insured_name),
  policy_number_present:Boolean(policy_number),
  vehicle_details_present:Boolean(engine_no&&chassis_no&&modelMatch),
  dates_present:Boolean(fields.own_damage_start&&fields.own_damage_end&&fields.third_party_start&&fields.third_party_end),
  od_liability_equal_net:od!==null&&liability!==null&&net!==null&&Math.abs(od+liability-net)<=1,
  tp_cpa_equal_liability:tp!==null&&cpa!==null&&liability!==null&&Math.abs(tp+cpa-liability)<=1,
  net_tax_equal_gross:net!==null&&tax!==null&&gross!==null&&Math.abs(net+tax-gross)<=1
};
if(raw.trim().length<100)warnings.push('No readable text; a scanned PDF needs OCR/vision');
if(!Object.values(checks).every(Boolean))warnings.push('Missing fields or failed financial checks: manual review required');

const improved=improveICICI(raw,fields,checks,warnings);
return [{json:improved}];
function improveICICI(raw, fields, checks, warnings) {
  const money=x=>{if(x==null)return null;const n=Number(String(x).replace(/,/g,''));return Number.isFinite(n)?n:null;};
  const nums=s=>(String(s||'').match(/\b\d[\d,]*\.\d{2}\b/g)||[]).map(money);
  const esc=x=>String(x==null?'Not extracted':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=n=>n==null?'Not extracted':'₹'+n.toLocaleString('en-IN',{maximumFractionDigits:2});
  const pstart=raw.search(/\bPremium Details\b/i),pend=raw.search(/\bGeographical Area\b/i);
  const p=pstart>=0?raw.slice(pstart,pend>pstart?pend:pstart+1600):'';
  const basicOdStart=p.search(/Basic OD Premium/i),basicTpStart=p.search(/Basic Third Party Liability/i);
  const odBlock=basicOdStart>=0&&basicTpStart>basicOdStart?p.slice(basicOdStart,basicTpStart):'';
  const subtotalIndex=odBlock.search(/Sub Total/i);
  const odLabels=subtotalIndex>=0?odBlock.slice(0,subtotalIndex).split('\n').map(s=>s.trim()).filter(Boolean):[];
  const odNumbers=nums(odBlock);
  // Two supported layouts: vertically extracted labels/amounts and insurer's
  // two-column schedule where each OD entry is followed by its amount on the
  // same line, with TP details in the right column.
  const verticalOD=!!(odLabels.length&&/^Basic OD Premium$/i.test(odLabels[0])&&odNumbers.length===odLabels.length+1);
  let basicOD=verticalOD?odNumbers[0]:null;
  let odAddons=verticalOD?odLabels.slice(1).map((name,i)=>({name,amount:odNumbers[i+1],page:2})):[];
  let printedOdSubtotal=verticalOD?odNumbers[odNumbers.length-1]:null;
  let odSum=verticalOD?odNumbers.slice(0,-1).reduce((a,b)=>a+b,0):null;
  let odBreakdownRecognized=verticalOD;
  if(!verticalOD){
    const leftStart=p.search(/Basic OD Premium/i);
    const leftEnd=p.search(/Total Own Damage Premium/i);
    const rows=leftStart>=0&&leftEnd>leftStart?p.slice(leftStart,leftEnd).split('\n').map(v=>v.trim()).filter(Boolean):[];
    const subIndex=rows.findIndex(v=>/^Sub Total\s+[\d,]+\.\d{2}\b/i.test(v));
    if(subIndex>0){
      const entries=rows.slice(0,subIndex).map(v=>v.match(/^(.+?)\s+([\d,]+\.\d{2})(?=\s|$)/));
      const subtotalMatch=rows[subIndex].match(/^Sub Total\s+([\d,]+\.\d{2})\b/i);
      if(entries.every(Boolean)&&/^Basic OD Premium$/i.test(entries[0][1].trim())&&subtotalMatch){
        const amounts=entries.map(m=>money(m[2]));
        const labels=entries.map(m=>m[1].trim());
        const total=amounts.reduce((a,b)=>a+b,0);
        const printed=money(subtotalMatch[1]);
        if(amounts.every(n=>n!==null&&n>=0)&&Math.abs(total-printed)<=0.01){
          basicOD=amounts[0];
          odAddons=labels.slice(1).map((name,i)=>({name,amount:amounts[i+1],page:2}));
          printedOdSubtotal=printed;
          odSum=total;
          odBreakdownRecognized=true;
        }
      }
    }
  }
  const tpBlockEnd=p.search(/Total Own Damage Premium/i);
  const tpBlock=basicTpStart>=0&&tpBlockEnd>basicTpStart?p.slice(basicTpStart,tpBlockEnd):'';
  const basicTP=nums(tpBlock)[0]??null;
  const igst=p.match(/IGST\s*%\s*([\d,]+\.\d{2})\s*`?\s*([\d,]+\.\d{2})/i)
    ||p.match(/%\s*([\d,]+\.\d{2})\s*IGST\s*`?\s*([\d,]+\.\d{2})/i);
  const igstRate=igst?money(igst[1]):null,igstExact=igst?money(igst[2]):null;
  const f=fields;
  // A bundled corporate policy may explicitly opt out of owner-driver CPA.
  // Only then may the TP-only liability be safely split as TP+zero CPA.
  const corporateNoCpa=/Compulsory Personal Accident cover has not been opted in this policy on account that,? the vehicle to be insured is not owned by an individual/i.test(raw)
    && /PA Cover for Owner.Driver[^\n]{0,170}?CSI\s*[\x60₹]?\s*0\s*\/-/i.test(raw);
  if(corporateNoCpa&&basicTP!==null&&f.total_liability_premium!==null
    &&Math.abs(basicTP-f.total_liability_premium)<=0.01){
    f.cpa_premium=0;
    f.tp_premium=basicTP;
    checks.tp_cpa_equal_liability=true;
  }
  const extraChecks={
    idv_present:f.idv!==null,
    manufacturing_year_present:Boolean(f.manufacturing_year),
    basic_od_plus_addons_equals_printed_total:odBreakdownRecognized&&f.od_premium!==null&&Math.abs(odSum-printedOdSubtotal)<=0.01&&Math.abs(printedOdSubtotal-f.od_premium)<=0.01,
    basic_tp_equals_derived_tp:basicTP!==null&&f.tp_premium!==null&&Math.abs(basicTP-f.tp_premium)<=0.01,
    exact_igst_rounds_to_tax:igstExact!==null&&f.total_tax!==null&&Math.round(igstExact)===f.total_tax
  };
  Object.assign(checks,extraChecks);
  const labels={
    is_icici_3005:'Insurer and Product Code 3005 identified',
    insured_name_present:'Name of Insured extracted',
    policy_number_present:'Policy number extracted',
    vehicle_details_present:'Vehicle make/model, engine and chassis present',
    dates_present:'OD and TP date ranges present',
    od_liability_equal_net:'OD + liability reconcile with net premium',
    tp_cpa_equal_liability:'Third-party premium + CPA reconcile with liability total',
    net_tax_equal_gross:'Net premium + printed tax reconcile with gross',
    idv_present:'Printed IDV identified',
    manufacturing_year_present:'Manufacturing year identified',
    basic_od_plus_addons_equals_printed_total:'Basic OD and add-ons reconcile with total OD',
    basic_tp_equals_derived_tp:'Basic TP matches TP breakdown',
    exact_igst_rounds_to_tax:'Exact IGST rounds to printed tax payable'
  };
  const errors=Object.entries(checks).filter(([k,v])=>!v).map(([k])=>labels[k]+' — review required');
  const warningList=[...new Set([...warnings.filter(w=>{
    if(corporateNoCpa&&f.cpa_premium===0&&w==='CPA/TP split could not be safely confirmed')return false;
    if(Object.values(checks).every(Boolean)&&w==='Missing fields or failed financial checks: manual review required')return false;
    return true;
  }),...errors])];
  const isValid=Object.values(checks).every(Boolean);
  const components={
    basic_od_premium:basicOD,
    od_addons:odAddons,
    printed_od_subtotal:printedOdSubtotal,
    total_od_premium:f.od_premium,
    basic_tp_premium:basicTP,
    owner_driver_cpa:f.cpa_premium,
    total_liability_premium:f.total_liability_premium,
    net_premium:f.net_premium,
    igst_rate_percent:igstRate,
    igst_exact:igstExact,
    printed_total_tax:f.total_tax,
    gross_premium:f.gross_premium
  };
  const evidence={
    insured_name:{page:1,label:'Name of Insured'},
    policy_number:{page:1,label:'Policy No.'},
    own_damage_start:{page:1,label:'Period of Insurance - Own Damage'},
    own_damage_end:{page:1,label:'Period of Insurance - Own Damage'},
    third_party_start:{page:1,label:'Period of Insurance - Third Party'},
    third_party_end:{page:1,label:'Period of Insurance - Third Party'},
    vehicle_make:{page:1,label:'Vehicle Make / Model'},vehicle_model:{page:1,label:'Vehicle Make / Model'},
    vehicle_registration:{page:1,label:'Vehicle Registration No.'},
    rto_city:{page:1,label:'RTO City'},
    vehicle_engine_number:{page:1,label:'Engine No.'},vehicle_chassis_number:{page:1,label:'Chassis No.'},
    manufacturing_year:{page:2,label:'Mfg Yr'},
    idv:{page:2,label:'Vehicle IDV / Total IDV'},
    od_premium:{page:2,label:'Total Own Damage Premium (A)'},
    tp_premium:{page:2,label:'Basic Third Party Liability'},
    cpa_premium:{page:2,label:'PA Cover for Owner Driver'},
    total_liability_premium:{page:2,label:'Total Liability Premium (B)'},
    net_premium:{page:2,label:'Total Package Premium (A+B)'},
    total_tax:{page:2,label:'Total Tax Payable'},
    gross_premium:{page:2,label:'Total Premium Payable'}
  };
  const proposal=[];
  const add=(key,label,value,page,labelEvidence,allow=true)=>{
    if(allow&&value!==null&&value!==undefined&&String(value).trim()!=='')
      proposal.push({key,label,value:String(value),confidence:null,page,evidence:labelEvidence});
  };
  const trusted=Boolean(checks.is_icici_3005);
  const finance=trusted&&checks.basic_od_plus_addons_equals_printed_total&&checks.basic_tp_equals_derived_tp&&checks.od_liability_equal_net&&checks.tp_cpa_equal_liability&&checks.net_tax_equal_gross&&checks.exact_igst_rounds_to_tax;
  add('insurer_name','Insurance company',f.insurer,1,'ICICI Lombard policy heading',trusted);
  add('policy_product','Policy product','Bundled',2,'Product Code 3005 / Bundled Two Wheeler Policy',trusted);
  const issueMatch=raw.match(/Policy Issued On\s*:?\s*([A-Za-z]{3}\s+\d{1,2},?\s+20\d{2})/i);
  const issuedOn=issueMatch?date(issueMatch[1]):null;
  add('policy_issuance_date','Policy issued on',issuedOn,2,'Policy Issued On',trusted&&Boolean(issuedOn));
  const exactChetak=/^CHETAK$/i.test(String(f.vehicle_make||''))&&/^(?:C|CHETAK[ -]+)(2501|3001|3501|3502|3503)$/i.test(String(f.vehicle_model||'').trim());
  const scooterLine=raw.split('\n').find(line=>/Solo With Pillion/i.test(line)&&/\b20\d{2}\b/.test(line))||'';
  const kwMatch=scooterLine.match(/Solo With Pillion\s+(\d{1,2}(?:\.\d{1,2})?)\s+20\d{2}/i);
  const verifiedKw=kwMatch&&Number(kwMatch[1])>0&&Number(kwMatch[1])<=50?String(Number(kwMatch[1])):'';
  const classVerified=/Bundled\s*[–-]\s*Two Wheeler Policy/i.test(raw);
  add('vehicle_class','Vehicle class','Two Wheeler',2,'Bundled – Two Wheeler Policy',trusted&&classVerified);
  // Recognised Chetak model PLUS independently printed CC/KW: no seat inference.
  add('vehicle_fuel_type','Fuel','Electric',2,'Known Chetak EV model and CC/KW',trusted&&classVerified&&exactChetak&&Boolean(verifiedKw));
  add('vehicle_motor_power_kw','Motor kW',verifiedKw,2,'Vehicle grid CC/KW',trusted&&classVerified&&exactChetak);
  const rtoParts=String(f.rto_city||'').split(/\s*[-–]\s*/);
  if(rtoParts.length===2&&/^[A-Z ]{4,40}$/i.test(rtoParts[0]))add('vehicle_rto_state','RTO state',rtoParts[0],1,'RTO City',trusted);
  add('policy_number','Policy number',f.policy_number,1,'Policy No.',trusted);
  add('policy_start_date','Valid from',f.own_damage_start,1,'Own Damage period start',trusted&&checks.dates_present);
  add('policy_end_date','Valid upto',f.own_damage_end,1,'Own Damage period end',trusted&&checks.dates_present);
  add('third_party_start_date','Third party cover from',f.third_party_start,1,'Third Party period start',trusted&&checks.dates_present);
  add('third_party_end_date','Third party cover upto',f.third_party_end,1,'Third Party period end',trusted&&checks.dates_present);
  add('insured_name','Name of Insured',f.insured_name,1,'Name of Insured',trusted);
  add('vehicle_make','Vehicle make',f.vehicle_make,1,'Vehicle Make / Model',trusted);
  add('vehicle_model','Vehicle model',f.vehicle_model,1,'Vehicle Make / Model',trusted);
  if(f.vehicle_registration==='NEW')add('vehicle_registration_status','Registration status','registration_pending',1,'Registration No. = NEW',trusted);
  else add('vehicle_registration_number','Registration number',f.vehicle_registration,1,'Vehicle Registration No.',trusted);
  add('vehicle_engine_number','Engine number',f.vehicle_engine_number,1,'Engine No.',trusted);
  add('vehicle_chassis_number','Chassis number',f.vehicle_chassis_number,1,'Chassis No.',trusted);
  add('vehicle_manufacturing_year','Manufacturing year',f.manufacturing_year,2,'Mfg Yr',trusted);
  add('vehicle_rto_name','RTO name',f.rto_city,1,'RTO City',trusted);
  add('idv','IDV / Sum insured',f.idv,2,'Vehicle IDV / Total IDV',trusted&&checks.idv_present);
  add('od_premium','OD premium',f.od_premium,2,'Total Own Damage Premium(A)',finance);
  add('tp_premium','Third party premium',f.tp_premium,2,'Basic Third Party Liability',finance);
  add('cpa_premium','CPA amount',f.cpa_premium,2,'PA Cover for Owner Driver',finance);
  // Printed net, GST and gross are comparison evidence only, never auto-apply.
  const row=(key,value,page)=>'<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#475569;width:37%">'+esc(key)+'</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:600">'+esc(value)+'</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:12px">p. '+esc(page)+'</td></tr>';
  const table=(title,rows)=>'<h3 style="margin:22px 0 6px;font-size:16px">'+esc(title)+'</h3><table style="width:100%;border-collapse:collapse;font-size:14px">'+rows.map(v=>row(...v)).join('')+'</table>';
  const policyRows=[['Insurer',f.insurer,1],['Product',f.product,2],['Name of Insured',f.insured_name,1],['Policy No.',f.policy_number,1],['OD Coverage',(f.own_damage_start||'?')+' to '+(f.own_damage_end||'?'),1],['TP Coverage',(f.third_party_start||'?')+' to '+(f.third_party_end||'?'),1]];
  const vehicleRows=[['Vehicle',[f.vehicle_make,f.vehicle_model].filter(Boolean).join(' '),1],['Registration',f.vehicle_registration,1],['RTO',f.rto_city,1],['Engine No.',f.vehicle_engine_number,1],['Chassis No.',f.vehicle_chassis_number,1],['Mfg Year',f.manufacturing_year,2],['IDV',fmt(f.idv),2]];
  const premiumRows=[['Basic OD',fmt(basicOD),2],...odAddons.map(a=>['Add-on: '+a.name,fmt(a.amount),2]),['Total OD',fmt(f.od_premium),2],['Basic TP',fmt(basicTP),2],['CPA',fmt(f.cpa_premium),2],['Total Liability',fmt(f.total_liability_premium),2],['Net Premium',fmt(f.net_premium),2],['IGST rate',igstRate===null?'Not extracted':igstRate+'%',2],['Exact printed IGST',fmt(igstExact),2],['Rounded tax payable',fmt(f.total_tax),2],['Gross Premium',fmt(f.gross_premium),2]];
  const checkRows=Object.entries(checks).map(([key,ok])=>'<li style="margin-bottom:4px;color:'+(ok?'#166534':'#991b1b')+'">'+(ok?'PASS: ':'REVIEW: ')+esc(labels[key]||key)+'</li>').join('');
  const publicJson={fields:f,premium_components:components,checks,source_evidence:evidence,insureit_proposal:proposal,warnings:warningList,validation_passed:isValid,review_required:true};
  const jsonDump=esc(JSON.stringify(publicJson,null,2));
  const html='<div style="max-width:840px;margin:20px auto;color:#172554;font-family:Arial,sans-serif;line-height:1.5"><h2 style="margin:0">ICICI 3005 — Policy Extraction</h2><p style="color:#475569">Native PDF text · <b>'+(isValid?'Automated checks passed':'Review needed')+'</b> · No INSUREIT records modified</p>'+
    table('Policy and insured',policyRows)+table('Vehicle and IDV',vehicleRows)+table('Premium breakdown',premiumRows)+
    '<h3 style="margin:22px 0 8px;font-size:16px">Validation</h3><ul style="padding-left:20px">'+checkRows+'</ul>'+
    '<p><strong>Warnings:</strong> '+esc(warningList.length?warningList.join('; '):'None detected automatically. Compare against the original PDF before accepting.')+'</p>'+
    '<p style="color:#64748b;font-size:12px">Page references follow the two tested ICICI 3005 layouts. The JSON proposal is for review only, not for direct database application.</p>'+
    '<details><summary style="cursor:pointer;font-weight:600">View structured JSON output</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f5f9;padding:12px;font-size:11px">'+jsonDump+'</pre></details></div>';
  return {...publicJson,review_html:html,extraction_method:'native_pdf_text_icici_3005_v2'};
}