// Review-only ICICI Lombard 3005/O parser for an n8n Code node.
// Native PDF text only; no OCR fallback, remote calls, or DB writes.
function parseIcici3005Od(text) {
  const raw=String(text||"").replace(/\r/g,"\n").replace(/\u00a0/g," ");
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
  const pno=match(/\b(3005\/O\/\d{7,12}\/\d{2}\/\d{3})\b/i);
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
  const deductions=lineAmount(/^Sub-Total Deductions\b/i);
  const od=lineAmount(/^Total Own Damage Premium\s*\(A\)/i);
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
