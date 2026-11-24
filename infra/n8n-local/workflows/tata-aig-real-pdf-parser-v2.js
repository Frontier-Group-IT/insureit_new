'use strict';
// INSUREIT local n8n: strict, reviewer-only Tata AIG motor parser for native text.
// Input is Extract From File `text`, not a customer record or a guessed plate.
const LAYOUTS = {
  private_package: { id: 'tata_aig_private_car_package_n8n_native_pdf', product: 'Package', clazz: 'PCP' },
  private_saod: { id: 'tata_aig_private_car_saod_n8n_native_pdf', product: 'Stand-Alone Own Damage', clazz: 'PCP' },
  private_bundled: { id: 'tata_aig_private_car_bundled_n8n_native_pdf', product: 'Bundled', clazz: 'PCP' },
  two_wheeler: { id: 'tata_aig_two_wheeler_bundled_n8n_native_pdf', product: 'Bundled', clazz: 'TWP' },
};
const KEYS = ['current_insurer_verified','supported_layout_verified','policy_identity_verified','insured_present','vehicle_identity_verified','vehicle_registration_status_verified','vehicle_specs_verified','rto_resolved','idv_verified','coverage_periods_verified','basic_od_ncb_reconciled','itemized_addons_reconciled','liability_components_reconciled','net_premium_reconciled','tax_premium_reconciled','gross_premium_reconciled','receipt_date_document_consistent','policy_number_receipt_agree'];
const clean = x => String(x ?? '').replace(/\s+/g,' ').trim();
const amount = x => Number(String(x ?? '').replace(/[₹,\s]/g,''));
const cent = n => Math.round(Number(n) * 100) / 100;
const near = (a,b,tolerance=0.04) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) <= tolerance;
function iso(input) {
  const m=String(input??'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m)return null;
  const date=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));
  return date.toISOString().slice(0,10)===`${m[3]}-${m[2]}-${m[1]}`?`${m[3]}-${m[2]}-${m[1]}`:null;
}
function match(text,regexp) {const m=text.match(regexp);return m?clean(m[1]):null;}
// Read an explicitly printed policy issue date, never the receipt, signature,
// policy-period start or PDF metadata. Some native PDF layouts emit the date
// immediately BEFORE its label. Conflicting labelled dates fail closed.
function printedPolicyIssueDate(text) {
 const label=String.raw`(?:Policy\s+(?:Issue|Issuance)\s+Date|Policy\s+Issued\s+On|Date\s+of\s+Issue)`;
 const day=String.raw`(\d{2}\/\d{2}\/\d{4})`;
 const found=[];
 for(const re of [
   new RegExp(String.raw`\b`+label+String.raw`\s*[:\-]?\s*`+day,'gi'),
   new RegExp(day+String.raw`\s{1,30}`+label+String.raw`\b`,'gi')
 ]) {
   let m;while((m=re.exec(text))) found.push(iso(m[1]));
 }
 const dates=[...new Set(found.filter(Boolean))];
 return {date:dates.length===1?dates[0]:null,ambiguous:found.length>0 && dates.length!==1};
}

function cash(text,regexp){const v=match(text,regexp);return v!==null?amount(v):null;}
function firstCurrencyAfter(text,anchor,limit=200){
  const m=typeof anchor==='string'?text.indexOf(anchor):text.search(anchor);
  if(m<0)return null;
  const after=text.slice(m+(typeof anchor==='string'?anchor.length:0),m+limit);
  const n=after.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
  return n?amount(n[1]):null;
}
function nearestLineValue(text,regexp){
 const m=text.match(regexp);if(!m)return null;
 return clean(m[1]);
}
function coverage(text,label){
 const labelPattern=label==='CPA'?'(?:Compulsory (?:PA Cover|Personal Accident Cover) for Owner-Driver)':label==='OD'?'Own Damage Cover':'Third-Party Cover';
 const re=new RegExp(labelPattern+String.raw`\s+(\d{2}\/\d{2}\/\d{4})\s*\([^)]*\)\s+(\d{2}\/\d{2}\/\d{4})`,'i');
 const found=text.match(re);
 return found?{from:iso(found[1]),to:iso(found[2])}:null;
}
function productFor(text){
 const first=text.slice(0,1000);
 if(/Bundled Auto Secure\s*-\s*Two Wheeler Policy\b/i.test(first))return LAYOUTS.two_wheeler;
 if(/Auto Secure\s*-\s*Private Car Package Policy\b/i.test(first))return LAYOUTS.private_package;
 if(/Auto Secure\s*-\s*Standalone Own Damage Private Car Policy\b/i.test(first))return LAYOUTS.private_saod;
 if(/Bundled Auto Secure\s*-\s*Private Car Policy\b/i.test(first))return LAYOUTS.private_bundled;
 return null;
}
function addonsFor(premium,layout){
 const from=premium.search(/Section\s*-\s*I Add[ -]On Covers/i);
 if(from<0)return [];
 const after=premium.slice(from);
 const end=after.search(/(?:Section\s*-\s*II Liability|Total Add[ -]On Premium\s*\([BC]\))/i);
 const text=(end>=0?after.slice(0,end):after.slice(0,3000));
 const found=[];
 // Actual PDFs: car '(Add) <wrapped name> (TAxx) <price>', two-wheeler 'Add : <name> (TAxx) <price>'.
 const regex=/\(Add\)|\bAdd\s*:/ig;
 const starts=[];let m;
 while((m=regex.exec(text)))starts.push(m.index);
 for(let i=0;i<starts.length;i++){
  const segment=text.slice(starts[i],starts[i+1]??text.length);
  const code=match(segment,/\((TA\d{2})\)/i);
  if(!code)continue;
  const rupees=segment.match(/₹\s*([\d,]+(?:\.\d{1,2})?)/);
  if(!rupees)continue;
  const name=clean(segment.slice(0,segment.indexOf('('+code+')')).replace(/^\(?Add\)?\s*: ?/i,''));
  found.push({code:code.toUpperCase(),name:name||`Add-on ${code}`,amount:amount(rupees[1])});
 }
 return found;
}
function splitPdfColumns(text, divider) {
  const left=[],right=[];
  for(const line of text.split('\n')) {
    // On real PDF text with layout preservation, the issuer prints two
    // simultaneous tables. Never interpret amounts from opposite columns.
    const a=line.slice(0,divider).trim(), b=line.slice(divider).trim();
    if(a)left.push(a);
    if(b)right.push(b);
  }
  return {left:left.join('\n'),right:right.join('\n')};
}
function seating(text){
  const lines=text.split('\n');
  for(let i=0;i<lines.length;i++){
    if(!/Seating Capacity/i.test(lines[i]))continue;
    const near=lines.slice(i,i+4);
    for(const line of near){
      const m=line.match(/(?:^|\s)([1-9]\d?)\s*$/);
      if(m)return m[1];
    }
  }
  return null;
}
function extract(raw){
 const text=String(raw??'').replace(/\r/g,'').replace(/\u00a0/g,' ');
 if(!text.trim()||text.length>500000)throw new Error('tata_aig_bad_pdf_text');
 const layout=productFor(text);
 if(!layout)throw new Error('tata_aig_unsupported_product');
 const checks=Object.fromEntries(KEYS.map(k=>[k,false]));
 checks.current_insurer_verified=/TATA\s+AIG\s+(?:GENERAL INSURANCE|family|as your Insurer)/i.test(text)&&/tataaig\.com/i.test(text)&&/For TATA AIG General Insurance Company Limited/i.test(text);
 checks.supported_layout_verified=true;
 const number=match(text,/\bPolicy No\.\s*(\d{10}\s+\d{2}\s+\d{2})\b/i);
 const policyNo=number?.replace(/\s/g,'')??null;
 checks.policy_identity_verified=Boolean(policyNo&&/^\d{14}$/.test(policyNo));
 const name=match(text,/Insured Details[\s\S]{0,250}?\bName\s+([A-Z][A-Z .&\d\-']{2,95}?)(?=\s{2,}|\n|Unlock Policy|\s+Address\b)/i);
 checks.insured_present=Boolean(name&&name.length<90&&!/^(?:Unlock|Address|Insured)/i.test(name));
 const isTw=layout.clazz==='TWP';
 const reg=match(text,/\bRegistration No\.\s*([A-Z0-9][A-Z0-9\s-]{0,18})(?=\n|\s{3,}|\bMake\s*\/\s*Model|\bDate of Registration)/i);
 const rawPlate=reg?.replace(/[\s-]/g,'').toUpperCase()??'';
 const unregistered=/^(?:NEW|NA|N\/A|NOTREGISTERED)$/.test(rawPlate);
 // Haryana schedules can print the older district+four-digit format,
 // e.g. HR 98 4481 (no alphabetic series). Require a separately printed
 // historic Date of Registration to avoid mistaking an incomplete prefix for
 // a registered vehicle. Do not infer any missing characters.
 const historicRegistration=match(text,/\bDate of Registration\s+(\d{2}\/\d{2}\/\d{4})/i);
 const validHistoricRegistration=iso(historicRegistration);
 const legacyHaryana=/^HR\d{6}$/.test(rawPlate)
   && Boolean(validHistoricRegistration
     && validHistoricRegistration <= new Date().toISOString().slice(0,10));
 const registered=/^(?:HR|DL|MP)[A-Z0-9]{7,13}$/.test(rawPlate)||legacyHaryana;
 const status=unregistered?'unregistered':registered?'registered':'unknown';
 checks.vehicle_registration_status_verified=status!=='unknown';
 // PDF.js omits the literal Certificate of prefix in actual Tata AIG PDFs.
 const vehicleStart=text.search(/(?:Certificate\s+of\s+Insurance|Insurance)\s+Cum\s+Policy\s+Schedule/i);
 const vehicleRaw=text.slice(vehicleStart>=0?vehicleStart:Math.max(0,text.search(/\bVehicle Details\b/i)));
 const layoutView=/\S {18,}\S/.test(vehicleRaw.slice(0,3000));
 const vehicleSection=layoutView?splitPdfColumns(vehicleRaw,78).left+'\n'+splitPdfColumns(vehicleRaw,78).right:vehicleRaw;
 const makeModel=match(vehicleSection,/Make\s*\/\s*Model\s*\/\s*(?:Variant\s*)?([\s\S]{3,145}?)(?=\n\s*Fuel Type|\s{4,}Mfg\. Year|\n\s*Engine|\n\s*Chassis)/i);
 let parts=(makeModel??'').split(/\s*\/\s*/);
 let make=parts.length>=3?parts[0].trim().toUpperCase():null;
 let model=parts.length>=3?clean(parts.slice(1).join(' / ')):null;
 if(model)model=model.replace(/\bVariant\b/gi,'').replace(/\s+/g,' ').replace(/\bHTK PLU S\b/g,'HTK PLUS').replace(/\b1\.5 CO RPORATE\b/g,'1.5 CORPORATE').replace(/\b1\.5\s*IMT\b/g,'1.5 IMT');
 const fuelPrinted=match(vehicleSection,/\bFuel Type\s+(PETROL|DIESEL|BATTERY|ELECTRIC|CNG|LPG)\b/i)?.toUpperCase()??null;
 const fuel=fuelPrinted==='BATTERY'?'ELECTRIC':fuelPrinted;
 const engine=match(vehicleSection,/Engine No\.\s*\/\s*Motor No\.\s*\(For\s+([A-Z0-9]{7,23})/i) ||match(vehicleSection,/(?:Engine (?:Number|No\.)\s*\/\s*(?:Motor No\.?\s*\(for EV\))?|Engine No\.\s*\/\s*Motor No\.\s*\(For\s*EV\)|Engine Number\s*\/\s*Motor No\.\s*\(for EV\))\s*([A-Z0-9]{6,25})/i)
  ||match(vehicleSection,/\bEV\)\s*([A-Z0-9]{6,25})/i);
 const chassis=match(vehicleSection,/\bChassis No\.\s*([A-Z0-9]{12,23})\b/i);
 const year=match(vehicleSection,/\bMfg\. Year\s*((?:19|20)\d{2})/i);
 const cckw=match(vehicleSection,/\bCC\s*\/\s*KW\s*(\d+(?:\.\d{1,2})?)/i);
 const seats=match(vehicleSection,/\bSeating Capacity\s*\(Including\s*Driver\)\s*(\d{1,2})/i) || seating(vehicleSection);
 const rto=match(vehicleSection,/\bRTO Location\s+([A-Z]{3,30})\b/i)?.toUpperCase()??null;
 const stateByRto={JABALPUR:'MADHYA PRADESH',SATNA:'MADHYA PRADESH',BADSHAPUR:'HARYANA',REWARI:'HARYANA',GURGAON:'HARYANA',FARIDABAD:'HARYANA',DELHI:'DELHI'};
 const state=stateByRto[rto]??null;
 const stateByPlate={MP:'MADHYA PRADESH',HR:'HARYANA',DL:'DELHI'};
 checks.vehicle_identity_verified=Boolean(engine&&chassis&&engine!==chassis&&engine.length>=7&&chassis.length>=14);
 checks.vehicle_specs_verified=Boolean(make&&model&&fuel&&year&&cckw&&seats&&Number(seats)>=1);
 checks.rto_resolved=Boolean(rto&&state&&(!registered||stateByPlate[rawPlate.slice(0,2)]===state));
 const idvMatch=vehicleRaw.match(/Insured Declared Value \(IDV\)[\s\S]{0,1500}?\n\s*1\s+([\d,]+)\s+0\s+0\s+0\s+0\s+([\d,.]+)/i);
 const idv=idvMatch?amount(idvMatch[2]):null;
 checks.idv_verified=Boolean(idv&&idv>0&&near(idv,amount(idvMatch[1]),0.01));
 const od=coverage(text,'OD'),tp=coverage(text,'TP'),pa=coverage(text,'CPA');
 const cpaNA=/Compulsory (?:PA Cover|Personal Accident Cover) for Owner-Driver\s+NA\s+NA/i.test(text);
 checks.coverage_periods_verified=layout===LAYOUTS.private_saod
   ? Boolean(od?.from&&od?.to&&od.to>=od.from&&!tp&&!pa&&/Standalone Own Damage Private Car Policy/i.test(text))
   : Boolean(od&&tp&&od.from&&od.to&&tp.from===od.from&&od.to>=od.from&&tp.to>=od.to&& (pa?pa.from===od.from&&pa.to>=pa.from:cpaNA));
 if(isTw)checks.coverage_periods_verified=checks.coverage_periods_verified&&tp.to>od.to;
 const premiumStart=text.search(/Schedule of Premium/i);
 const premOriginal=premiumStart>=0?text.slice(premiumStart):'';
 const formatted=/\S {18,}\S/.test(premOriginal.slice(0,3800));
 const premiumColumns=formatted?splitPdfColumns(premOriginal,isTw?79:78):null;
 const prem=formatted?premiumColumns.left+'\n'+premiumColumns.right:premOriginal;
 const basicOd=isTw?cash(prem,/Premium on Vehicle\s*₹\s*([\d,.]+)/i):firstCurrencyAfter(prem,/Premium on Vehicle and Non-/i,130);
 const odPrinted=cash(prem,/Total Own Damage Premium\s*\(A\)\s*₹\s*([\d,.]+)/i);
 const printedNcb=cash(prem,/Less\s*:\s*No claim bonus[^₹\n]*₹\s*([\d,.]+)/i);
 // A policy with no printed NCB deduction may have zero NCB. Only accept zero
 // when the independently printed basic OD and total OD match exactly.
 const ncb=isTw?0:printedNcb??(basicOd!==null&&odPrinted!==null&&near(basicOd,odPrinted,0.03)?0:null);
 checks.basic_od_ncb_reconciled=near((basicOd??NaN)-(ncb??NaN),odPrinted??NaN,0.03);
 const addons=addonsFor(prem,layout);
 const addonTotal=cash(prem,layout===LAYOUTS.private_saod
   ? /Total Add[ -]on Premium\s*\(B\)\s*₹\s*([\d,.]+)/i
   : /Total Add[ -]On Premium\s*\(C\)\s*₹\s*([\d,.]+)/i);
 checks.itemized_addons_reconciled=addonTotal!==null&&near(addonTotal,addons.reduce((v,a)=>v+a.amount,0),0.045);
 const saodNoLiability=layout===LAYOUTS.private_saod&&!/Section\s*-\s*II Liability|Total Liability Premium\s*\(B\)/i.test(prem);
 const basicTp=saodNoLiability?0:cash(prem,/Basic TP [Pp]remium\s*₹\s*([\d,.]+)/i);
 const ownerDriverCpa=isTw?
   (cash(prem,/Compulsory Personal Accident Cover for Owner\s*₹\s*([\d,.]+)/i)??cash(prem,/Compulsory Personal Accident Cover for Owner\s*Driver\s*₹\s*[\d,.]+\s*₹\s*([\d,.]+)/i)??0):
   (firstCurrencyAfter(prem,/\d+Year\(s\) Compulsory PA cover for/i,125)??0);
 const passenger=isTw?0:(cash(prem,/PA cover to unnamed passengers[\s\S]{0,140}?₹\s*([\d,.]+)/i)??0);
 const legal=isTw?0:(cash(prem,/Add: Legal liability to paid driver[\s\S]{0,150}?₹\s*([\d,.]+)/i)??0);
 const liability=saodNoLiability?0:cash(prem,/Total Liability Premium\s*\(B\)\s*₹\s*([\d,.]+)/i);
 const rsa=isTw?0:(cash(prem,saodNoLiability
   ? /Total Others\s*\(C\)\s*₹\s*([\d,.]+)/i
   : /Total Others\s*\(D\)\s*₹\s*([\d,.]+)/i)??0);
 checks.liability_components_reconciled=near((basicTp??NaN)+ownerDriverCpa+passenger+legal,liability??NaN,0.03);
 const printedNet=cash(prem,/Net Premium\s*\(A\+B\+C(?:\+D)?\)\s*₹\s*([\d,.]+)/i);
 const net=cent((odPrinted??NaN)+(addonTotal??NaN)+(liability??NaN)+rsa);
 checks.net_premium_reconciled=near(net,printedNet??NaN,1.01);
 const igst=cash(prem,/IGST\s*@\s*18%\s*₹\s*([\d,.]+)/i);
 const sgst=cash(prem,/SGST\s*9%\s*₹\s*([\d,.]+)/i);
 const cgst=cash(prem,/CGST\s*9%\s*₹\s*([\d,.]+)/i);
 const tax=igst!==null?igst:(sgst!==null&&cgst!==null?cent(sgst+cgst):null);
 const gross=cash(prem,/Total Policy Premium\s*₹\s*([\d,.]+)/i);
 const headerGross=cash(text,/Premium Amount\s*\(Including GST\)\s*₹\s*([\d,.]+)/i);
 checks.tax_premium_reconciled=Boolean(tax!==null&&gross!==null&&printedNet!==null&&near(printedNet+tax,gross,0.01));
 checks.gross_premium_reconciled=Boolean(gross!==null&&headerGross!==null&&near(gross,headerGross,0.01));
 const printedIssue=printedPolicyIssueDate(text);
 const signed=match(text,/Digitally Signed by:[\s\S]{0,100}?\bDate:\s*(\d{2}\/\d{2}\/\d{4})/i);
 const receipt=match(text,/\bReceipt Date\s*(\d{2}\/\d{2}\/\d{4})/i);
 // A rasterized digital-signature date is not guaranteed to appear in PDF.js text.
 // Instead verify the printed receipt date against the covered period. When
 // the signature date IS present, its date must agree with the receipt.
 // Never infer issuance date from receipt, signing, or coverage dates.
 const receiptDate=receipt?iso(receipt):null;
 const receiptEpoch=receiptDate?Date.parse(receiptDate+'T00:00:00Z'):NaN;
 const odStartEpoch=od?.from?Date.parse(od.from+'T00:00:00Z'):NaN;
 const odEndEpoch=od?.to?Date.parse(od.to+'T00:00:00Z'):NaN;
 checks.receipt_date_document_consistent=Boolean(receiptDate
   && Number.isFinite(odStartEpoch) && Number.isFinite(odEndEpoch)
   && receiptEpoch>=odStartEpoch-366*86400000 && receiptEpoch<=odEndEpoch
   && (!signed||signed===receipt));
 // The receipt must contain the exact current policy number, not a previous/TP reference.
 const receiptIx=text.lastIndexOf('Receipt Date');
 const receiptSection=receiptIx>=0?text.slice(receiptIx,receiptIx+2500):'';
 const chunks=policyNo?policyNo.match(/^(\d{10})(\d{2})(\d{2})$/):null;
 const receiptRe=chunks?new RegExp(chunks[1]+String.raw`[\s\S]{0,160}?`+chunks[2]+String.raw`\s+`+chunks[3]):null;
 checks.policy_number_receipt_agree=Boolean(receiptRe&&receiptRe.test(receiptSection));
 const failed=Object.entries(checks).filter(([,pass])=>!pass).map(([k])=>k);
 const fields={
  insurer_name:'Tata AIG General Insurance Company Limited',policy_product:layout.product,policy_number:policyNo,
  insured_name:name?.replace(/^(MR|MRS|MISS|MS)\.?\s+/i,'').trim()??null,policy_type:'Motor',
  vehicle_registration_status:status,vehicle_registration_number:registered?rawPlate:null,
  vehicle_class:layout.clazz,vehicle_make:make,vehicle_model:model,vehicle_fuel_type:fuel,
  vehicle_manufacturing_year:year,vehicle_capacity_cc:cckw,vehicle_motor_power_kw:isTw?cckw:null,
  vehicle_seating_capacity:seats,vehicle_chassis_number:chassis,vehicle_engine_number:engine,
  vehicle_rto_city:rto,vehicle_rto_state:state,idv,
  policy_start_date:od?.from??null,policy_end_date:od?.to??null,
  third_party_start_date:tp?.from??null,third_party_end_date:tp?.to??null,
  cpa_start_date:pa?.from??null,cpa_end_date:pa?.to??null,
  policy_issuance_date:printedIssue.date,od_premium:odPrinted,addon_premium:addonTotal,tp_premium:basicTp,cpa_amount:ownerDriverCpa,
 };
 const rawPremium={basic_od:basicOd,ncb_discount:ncb,od_after_ncb:odPrinted,addons,addon_total:addonTotal,
  basic_tp:basicTp,owner_driver_cpa:ownerDriverCpa,paid_driver_liability:legal,
  unnamed_passenger_pa:passenger,total_liability:liability,roadside_assistance:rsa,
  printed_net:printedNet,component_net:net,tax,printed_gross:gross,
  receipt_date:receipt?iso(receipt):null,digital_signature_date:signed?iso(signed):null};
 const form={od_premium:odPrinted,addon_premium:addonTotal,tp_premium:cent((basicTp??NaN)+legal+passenger+rsa),cpa_amount:ownerDriverCpa};
 const formNet=cent((form.od_premium??NaN)+(form.addon_premium??NaN)+(form.tp_premium??NaN)+form.cpa_amount);
 return {
  contract_version:'tata_aig_candidate_v2',review_required:true,auto_finalize_allowed:false,
  parser_id:layout.id,parser_version:'tata-aig-layout-v1',
  printed_issue_date_ambiguous:printedIssue.ambiguous,
  ok:failed.length===0&&!printedIssue.ambiguous,
  checks,checks_passed:KEYS.length-failed.length,failed_checks:failed,fields,
  premium_components:rawPremium,form_premium_projection:form,form_premium_reconciled:near(formNet,net,0.01),
  warnings:[...(printedIssue.ambiguous?['Conflicting printed Policy Issue Date labels require review']:[]),
    ...(!printedIssue.date?['Policy Issue Date is not explicitly printed; receipt is not issuance evidence']:[])],booking_ready:false,
 };
}
return $input.all().map(item=>{
 try{return {json:extract(item.json.text||item.json)};}
 catch(e){return {json:{ok:false,error_code:'tata_aig_review_required',failed_checks:['parser_text_layout_unverified'],detail_class:String(e.message).slice(0,80)}};}
});
