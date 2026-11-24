// Isolated SBI General Private Car Package native-PDF parser. Review-only.
'use strict';
const text=String($input.first()?.json?.text||'').replace(/\r/g,'').replace(/\u00a0/g,' ');
const flat=text.replace(/\s+/g,' ');
const info=$input.first()?.json?.info||{};
const pdfCreated=/^D:(\d{4})(\d{2})(\d{2})/.exec(String(info.CreationDate||''));
const pdfCreationDay=pdfCreated?pdfCreated[1]+'-'+pdfCreated[2]+'-'+pdfCreated[3]:null;
const grab=(re,s=flat)=>re.exec(s)?.[1]?.trim()??null;
const money=(re,s=flat)=>{let v=grab(re,s);return v===null?null:Number(v.replace(/[,₹\s]/g,''));};
const toIso=(s)=>{let m=s?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?m[3]+'-'+m[2]+'-'+m[1]:null;};
const close=(a,b,t=.06)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t;
const fields=[],put=(key,value,evidence)=>{if(value===null||value===undefined||value==='')return;fields.push({key,label:key,value:String(value),confidence:null,page:null,evidence});};
const insurer=/SBI General Insurance Company Limited/i.test(flat);
const product=/Private Car Insurance Policy\s*-\s*Package/i.test(flat);
const number=grab(/Policy\s*\/\s*Certificate No\s*:\s*(POPMCAR\d{11})/i);
const numberReceipt=grab(/Policy Number\s+(POPMCAR\d{11})/i);
const insured=grab(/Policy Holder Name\s+((?:Mr|Mrs|Ms)\.?\s+[A-Za-z ]{3,65})\s+Intermediary Name/i);
// Issuance-date precedence: explicitly printed schedule date first.
// The signature image is a fallback ONLY when the printed date is absent.
// The PDF-text node does not render/OCR a signature image, so a missing date
// must remain review-required until independently extracted image evidence exists.
// Receipt date, PDF creation metadata and coverage start are never substitutes.
const printedIssue=toIso(grab(/(\d{2}\/\d{2}\/\d{4})\s+POPMCAR\d{11}\s+Period of Insurance TP/i));
const signatureImageEvidence=$input.first()?.json?.signature_image_evidence;
const imageFallback=signatureImageEvidence?.source==='verified_pdf_signature_image'
  &&signatureImageEvidence?.verified===true
  &&signatureImageEvidence?.document_bound===true
  ?toIso(String(signatureImageEvidence.date||'')):null;
const issue=printedIssue||imageFallback;
const issueSource=printedIssue?'printed_policy_issue_date'
  :imageFallback?'verified_signature_image_fallback':'not_verified';
const receiptDate=toIso(grab(/Receipt Date\s+(\d{2}\/\d{2}\/\d{4})/i));
const issueDateValidated=!!issue&&issueSource!=='not_verified';
const period=flat.match(/Period of Insurance OD\s*:\s*From:(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}\s+To:(\d{2}\/\d{2}\/\d{4})/i)||[];
const start=toIso(period[1]),end=toIso(period[2]);
const tpPeriod=flat.match(/Period of Insurance TP\s*:\s*From:(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}\s+To:(\d{2}\/\d{2}\/\d{4})/i)||[];
const tpStart=toIso(tpPeriod[1]),tpEnd=toIso(tpPeriod[2]);
const plate=grab(/Registration Number\s+(UK\d{2}[A-Z]{1,3}\d{4})/i);
const tata=/Tata Motors,\s*Punch\s*&\s*Adventure/i.test(flat)
  ||/Vehicle Make\s+Tata Motors\s+Vehicle Model\s+Punch\s+Vehicle Variant\s+Adventure/i.test(flat);
const mahindra=/Mahindra\s*&\s*Mahindra,?\s*XUV\s*300\s*-\s*Petrol\s*&\s*W8\s*\(O\)/i.test(flat)
  ||/Vehicle Make\s+Mahindra\s*&\s*Mahindra\s+Vehicle Model\s+XUV\s*300\s*-\s*Petrol\s+Vehicle Variant\s+W8\s*\(O\)/i.test(flat);
const variant=tata&&!mahindra?'tata_punch_package':mahindra&&!tata?'mahindra_xuv300_package':null;
const make=tata&&!mahindra?'TATA':mahindra&&!tata?'MAHINDRA':null;
const model=make==='TATA'?'PUNCH ADVENTURE':make==='MAHINDRA'?'XUV 300 W8 (O)':null;
const engine=grab(/Engine Number\s+([A-Z0-9]{8,30})/i)
  ??grab(/\b(REVTRN[A-Z0-9]{8,25}|NMNZH[A-Z0-9]{4,25})\s*&/i);
const chassis=grab(/Chassis Number\s+([A-Z0-9]{12,30})/i)
  ??grab(/\b(?:REVTRN[A-Z0-9]{8,25}|NMNZH[A-Z0-9]{4,25})\s*&\s*([A-Z0-9]{12,30})/i);
const year=grab(/Year of Manufacture\s+(\d{4})/i);
const cc=grab(/(?:Cubic Capacity\s*\/\s*Kilo Watt\s*\/\s*Gross Vehicle Weight\s*\/\s*Horsepower|Cubic Capacity\s*\/\s*Kilo Watt)\s+(\d{3,4})\b/i)
 ||(variant==='tata_punch_package'&&/\b1199\s+Petrol\s+2023\b/i.test(flat)?'1199':null)
 ||(variant==='mahindra_xuv300_package'&&/\b1197\s+Petrol\s+2022\b/i.test(flat)?'1197':null);
const fuel=grab(/\bFuel\s+(Petrol|Diesel|CNG)\b/i)
 ||(/\b(?:1199\s+Petrol\s+2023|1197\s+Petrol\s+2022)\b/i.test(flat)?'Petrol':null);
const rtoRaw=grab(/RTO Location\s+(Roorkee|Dehra\s*Dun)\b/i);
const rto=rtoRaw?/Dehra\s*Dun/i.test(rtoRaw)?'Dehradun':rtoRaw:null;
const idv=money(/Your Vehicle IDV\s+Vehicle Non Electrical Accessory Electrical Accessory CNG\/LPG Total IDV\s+([\d,.]+)/i)
  ??money(/Total IDV\s+([\d,.]+)/i);
const basicOd=money(/Own Damage Basic\s+([\d,.]+)/i);
const premiumStart=flat.indexOf('WE COVER YOU FOR');
const premiumEnd=flat.indexOf('TOTAL OWN DAMAGE',premiumStart);
const premiumText=premiumStart>=0&&premiumEnd>premiumStart?flat.slice(premiumStart,premiumEnd):'';
const coverNames=['Consumable','Depreciation Reimbursement','Engine Guard',
  'Key Replacement Cover','Loss of Personal Belongings','Road Side Assistance'];
const addonLines=coverNames.map(name=>{
 const match=new RegExp('\\b'+name+'\\s+([\\d,.]+)','i').exec(premiumText);
 return {name,amount:match?Number(match[1].replace(/,/g,'')):0,
   exists:!!match};
});
const addOns=addonLines.filter(x=>x.exists).map(x=>x.amount);
const ncbPercent=money(/No Claim Bonus\s*%\s*(\d{1,3})%/i,premiumText);
const od=money(/TOTAL OWN DAMAGE\s+PREMIUM\s+([\d,.]+)/i);
const tp=money(/Third Party Basic\s+Premium\s+([\d,.]+)/i);
const cpa=money(/PA to Owner Driver\s+([\d,.]+)/i);
const tpWithCpa=money(/TOTAL TP\s+PREMIUM\s+([\d,.]+)/i);
const net=money(/TOTAL PREMIUM\s+([\d,.]+)/i);
const gst=money(/\bGST\s+([\d,.]+)\s+FINAL PREMIUM/i);
const gross=money(/FINAL PREMIUM\s+([\d,.]+)/i);
const addOn=addOns.length>=4&&addOns.every(Number.isFinite)
  ?Number(addOns.reduce((a,b)=>a+b,0).toFixed(2)):null;
const ncbDiscount=basicOd!==null&&addOn!==null&&od!==null
  ?Number((basicOd+addOn-od).toFixed(2)):null;
const odBasicAfterNcb=od!==null&&addOn!==null
  ?Number((od-addOn).toFixed(2)):null;
const pfx='Native PDF: SBI General Package Policy';
put('insurer_name','SBI General Insurance Company Limited',pfx);
put('policy_product','Package',pfx);
put('policy_number',number,'Native PDF: Policy / Certificate No');
put('insured_name',insured,'Native PDF: Premium Receipt Policy Holder Name');
put('policy_issuance_date',issue,printedIssue?'Native PDF: printed Policy Issue Date':'Verified PDF signature image: fallback issue date');
put('policy_start_date',start,'Native PDF: OD Period From');
put('policy_end_date',end,'Native PDF: OD Period To');
put('third_party_start_date',tpStart,'Native PDF: TP Period From');
put('third_party_end_date',tpEnd,'Native PDF: TP Period To');
put('vehicle_registration_status','registered','Native PDF: Registration Number');
put('vehicle_registration_number',plate,'Native PDF: Registration Number');
put('vehicle_class','Private Car',pfx);
put('vehicle_make',make,'Native PDF: Vehicle Make Model & Variant');
put('vehicle_model',model,'Native PDF: Vehicle Make Model & Variant');
put('vehicle_manufacturing_year',year,'Native PDF: Year of Manufacture');
put('vehicle_rto_state','Uttarakhand','Registered UK plate + native PDF RTO');
put('vehicle_rto_name',rto,'Native PDF: RTO Location');
put('vehicle_chassis_number',chassis,'Native PDF: Engine & Chassis Number');
put('vehicle_engine_number',engine,'Native PDF: Engine & Chassis Number');
put('vehicle_capacity',cc,'Native PDF: CC');
put('vehicle_fuel_type',fuel,'Native PDF: Fuel');
put('idv',idv,'Native PDF: Total IDV');
put('od_premium',od,'Native PDF: Total Own Damage Premium including add-ons');
put('tp_premium',tp,'Native PDF: Third Party Basic Premium excluding CPA');
put('cpa_premium',cpa,'Native PDF: PA to Owner Driver');
const checks={
 insurer_verified:insurer,package_product_verified:product,
 policy_identity_verified:!!number&&number===numberReceipt&&!!insured,
 issue_and_signature_date_consistent:issueDateValidated,
 od_period_evidenced:!!start&&!!end&&end>start,
 tp_period_evidenced:!!tpStart&&!!tpEnd&&tpStart===start&&tpEnd===end,
 registered_plate_evidenced:!!plate&&/^UK\d{2}[A-Z]{1,3}\d{4}$/.test(plate),
 make_model_evidenced:!!make&&!!model,vehicle_identity_evidenced:!!engine&&!!chassis,
 registration_year_and_fuel_verified:!!year&&!!fuel,
 capacity_evidenced:!!cc,rto_authority_evidenced:!!rto,
 idv_printed:idv!==null&&idv>0,od_basic_and_addons_printed:basicOd!==null&&basicOd>0&&addOn!==null,
 od_including_addons_reconciled:!!variant&&ncbPercent!==null
   &&ncbPercent>=0&&ncbPercent<=65&&ncbDiscount!==null&&ncbDiscount>=0
   &&close(ncbDiscount,basicOd*ncbPercent/100,.02)
   &&close(od,basicOd+addOn-ncbDiscount,.02),
 tp_and_cpa_separate:tp>0&&cpa>0&&close(tpWithCpa,tp+cpa),
 total_net_reconciled:close(net,od+tp+cpa),
 gst_18_percent_reconciled:close(gst,Math.round(net*.18*100)/100),
 gross_rounded_reconciled:close(gross,Math.round(net+gst),.01),
 stamp_separately_disclosed:/Consolidated Stamp Duty\s*₹\s*0\.5/i.test(flat)
};
const failed_checks=Object.keys(checks).filter(k=>checks[k]!==true);
return [{json:{contract_version:'1',parser_id:'sbi_general_private_car_package_native_pdf',parser_version:'insureit-product-extension-v1',
 ok:failed_checks.length===0,validation_passed:failed_checks.length===0,review_required:true,auto_finalize_allowed:false,
 extraction_method:'native_pdf_text',checks,failed_checks,fields,warnings:failed_checks.map(k=>'Evidence incomplete: '+k),
 premium_components:{od,tp,cpa,net,gst,gross,addOn,odBasic:basicOd,
   odBasicAfterNcb,ncbPercent,ncbDiscount,tpWithCpa},
 layout_variant:variant,issuance_evidence:{date:issue,source:issueSource,
   printed_date:printedIssue,receipt_date:receiptDate,
   signature_image_fallback_used:!printedIssue&&!!imageFallback,
   signature_present:info.IsSignaturesPresent===true,
   cryptographic_signature_verified:false}}}];
