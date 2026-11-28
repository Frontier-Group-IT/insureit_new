/* Isolated source-certified United India GCV Haryana Mahindra split-CGST/SGST
 * source variant, evaluated inside the existing read-only n8n Code node.
 * Requires the node's existing grab/amountAfter/validDate/approx/output helpers.
 * Never issues insurance or books any canonical record.
 */
function unitedIndiaHaryanaMahindra(t){
 const head=t.slice(0,7500),startIx=t.indexOf('Particulars of Vehicle Insured');
 const block=startIx>=0?t.slice(startIx,startIx+2300):'';
 const vehicleRow=block.split(/\bRegistration Authority\b/i)[0];
 const identities=[...vehicleRow.matchAll(/\b(HR\s*-\s*\d{2}\s*-\s*[A-Z]{1,3}\s*-\s*\d{3,4})\s+No\s+(TUR[A-Z0-9]{7,14})\s+(MA1[A-Z0-9]{14,21})/gi)];
 const identity=identities.length===1?identities[0]:null;
 const reg=identity?.[1]?.replace(/[\s-]/g,'').toUpperCase()??null;
 const engine=identity?.[2]??null,chassis=identity?.[3]??null;
 const sourceMake=/MAHINDRA\s*&\s*MAHINDRA\s+LIMITED\s*\/\s*BOL\s+MAXX\s+PUP\s+CITY\s+1\.3\s+LXD/i.test(vehicleRow);
 const model=sourceMake?'BOL MAXX PUP CITY 1.3 LXD':null;
 const fuel=grab(vehicleRow,/\bOPEN\s+BODY\s*\/\s*(Diesel)\b/i);
 const specs=vehicleRow.match(/\b(20\d{2})\s+(\d{3,5})\s+(\d{3,5})\b/);
 const year=specs?.[1]??null,cc=specs?.[2]??null;
 const rtoCode=reg?.slice(0,4)??"";
 const match=block.match(/Registration Authority[\s\S]{0,230}?\n(HR\d{2}\s+[A-Z ]{3,55}\s+INDIA)\b/i);
 const printedAuthority=match?.[1]?.replace(/\s+/g," ").trim().toUpperCase()??"";
 const rto=printedAuthority.startsWith(rtoCode+" ")&&printedAuthority.endsWith(" INDIA")
   ?printedAuthority.slice(rtoCode.length+1,-" INDIA".length).trim():null;
 const policy=grab(head,/\bPolicy No\.?\s*:?\s*(\d{6,12}P\d{9})\b/i);
 const certificate=grab(head,/\bCertificate Number\s+(\d{6,12}P\d{9})\b/i);
 const insured=grab(head,/\bName of the Insured\s+(M(?:R|S|\/S)\.?\s+[^\n]{3,95})\s*\nAddress of the Insured/i);
 const issue=validDate(grab(t,/\bDate of Issue\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i));
 const coverageStart=validDate(grab(t,/\bFrom\s+\d{2}:\d{2}\s+Hrs\s+of\s+(\d{2}\/\d{2}\/\d{4})/i)
   ||grab(t,/Effective date of commencement of Insurance for the purpose of Act\s+from\s+\d{2}:\d{2}\s+Hrs\s+on\s*(\d{2}\/\d{2}\/\d{4})/i));
 const coverageEnd=validDate(grab(t,/\bTo\s+Midnight\s+of\s+(\d{2}\/\d{2}\/\d{4})/i)
   ||grab(t,/Date of Expiry of the Insurance\s+Midnight on\s+(\d{2}\/\d{2}\/\d{4})/i));
 const idv=amountAfter(t,/\bInsured['’]s Declared Value\s+([\d,]+)/i);
 const od=amountAfter(t,/\bGross OD\(A\)\s*([\d,.]+)/i);
 const tp=amountAfter(t,/\bGross TP\(B\)\s*([\d,.]+)/i);
 const net=amountAfter(t,/\bGross OD\s*&\s*TP:\s*\(A\)\s*\+\s*\(B\)\s*([\d,.]+)/i);
 const cgstOthers=amountAfter(t,/\bCGST-Others\(9%\)\s*:?\s*([\d,.]+)/i);
 const sgstOthers=amountAfter(t,/\bSGST-Others\(9%\)\s*:?\s*([\d,.]+)/i);
 const cgstBasicTp=amountAfter(t,/\bCGST-Basic TP\(2\.50%\)\s*:?\s*([\d,.]+)/i);
 const sgstBasicTp=amountAfter(t,/\bSGST-Basic TP\(2\.50%\)\s*:?\s*([\d,.]+)/i);
 const taxes=[cgstOthers,sgstOthers,cgstBasicTp,sgstBasicTp];
 const gst=taxes.every(n=>typeof n==='number')?taxes.reduce((a,b)=>a+b,0):null;
 const gross=amountAfter(t,/\bTotal\s*\(Rounded Off\)\s*:\s*([\d,.]+)/i);
 const stamp=amountAfter(t,/\bStamp Duty\s*:?\s*([\d,.]+)/i);
 const basicTp=amountAfter(t,/\bB\.\s*Basic\s*-\s*TP\s+([\d,.]+)/i);
 const cpa=amountAfter(t,/\bCompulsory PA for Owner Driver\s+([\d,.]+)/i);
 const driver=amountAfter(t,/\bLL to Paid Driver IMT 28\s+([\d,.]+)/i);
 const basicOd=amountAfter(t,/\bA\.\s*Basic\s*-\s*OD\s+([\d,.]+)/i);
 const lamps=amountAfter(t,/\bCover for lamps,\s*tyres,\s*tubes etc\s+([\d,.]+)/i);
 const nilDep=amountAfter(t,/\bNil Depreciation Without Excess\s+([\d,.]+)/i);
 const ncb=amountAfter(t,/\bNo Claim Bonus\s+\d{1,2}%\s+([\d,.]+)/i);
 const base={
   policy_number:policy,insured_name:insured,policy_product:'Goods Carrying Vehicle Package',
   policy_start_date:coverageStart,policy_end_date:coverageEnd,policy_issuance_date:issue,
   third_party_start_date:coverageStart,third_party_end_date:coverageEnd,
   vehicle_registration_number:reg,vehicle_registration_status:reg?'registered':null,
   vehicle_make:sourceMake?'Mahindra':null,vehicle_model:model,vehicle_class:'Goods Carrying Vehicle',
   vehicle_fuel_type:fuel,vehicle_manufacturing_year:year,vehicle_capacity:cc,
   vehicle_chassis_number:chassis,vehicle_engine_number:engine,
   vehicle_rto_name:rto,vehicle_rto_state:reg?'Haryana':null,idv,cpa_premium:cpa,
 };
 const printed={od,tp,net,gst,gross,cgstOthers,sgstOthers,cgstBasicTp,sgstBasicTp,
   stampDuty:stamp,taxRegime:'CGST_SGST'};
 const extra={
   uiic_layout:/UNITED INDIA INSURANCE COMPANY LIMITED/i.test(head)
     &&/GCV PUBLIC CARRIER OTHER THAN 3 WHEELER/i.test(head)
     &&!!identity&&sourceMake,
   split_cgst_sgst_components_printed:taxes.every(n=>typeof n==='number'),
   stamp_accounting_disclosed:stamp!==null,
   stamp_charge_reconciled:stamp!==null&&approx(gross,Number(net)+Number(gst)),
 };
 const supplemental={
   certificate_policy_match:!!policy&&policy===certificate,
   source_vehicle_fuel_year_cc:!!model&&fuel==='Diesel'&&!!year&&Number(cc)>0,
   rto_matches_current_registration:!!rto&&printedAuthority.startsWith(rtoCode+' '),
   positive_cpa_and_paid_driver_itemized:cpa!==null&&cpa>0&&driver!==null&&driver>0
     &&basicTp!==null&&approx(tp,basicTp+cpa+driver),
   od_components_reconciled:[basicOd,lamps,nilDep,ncb].every(v=>typeof v==='number')
     &&approx(od,basicOd+lamps+nilDep-ncb,.5),
   printed_split_taxable_bases:taxes.every(v=>typeof v==='number')
     &&cgstOthers===sgstOthers&&cgstBasicTp===sgstBasicTp
     &&Math.abs(cgstOthers-Math.round((od+cpa+driver)*.09))<=1
     &&Math.abs(cgstBasicTp-Math.round(basicTp*.025))<=1,
 };
 const warnings=Object.entries(supplemental).filter(([,ok])=>ok!==true)
   .map(([key])=>'Review required: '+key);
 const result=output('United India Insurance Company Limited',
   'united_india_gcv_haryana_mahindra_split_gst_native_pdf',base,printed,extra,warnings);
 result.fields=result.fields.map(field=>{
   if(field.key==='vehicle_rto_name')return {...field,evidence:'UIIC PDF vehicle Registration Authority: '+printedAuthority};
   if(field.key==='vehicle_rto_state')return {...field,evidence:'UIIC PDF current HR registered plate prefix'};
   if(field.key==='vehicle_make')return {...field,evidence:'UIIC PDF MAHINDRA & MAHINDRA LIMITED canonical manufacturer'};
   if(field.key==='cpa_premium')return {...field,evidence:'UIIC PDF Compulsory PA for Owner Driver: '+cpa.toFixed(2)+' included in Gross TP(B)'};
   return field;
 });
 return result;
}
