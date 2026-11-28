/**
 * National GCV issued-policy RECORD import. No new insurance is issued.
 *
 * A zero *separately charged* owner-driver PA amount is NOT proof of a
 * waiver or absence of cover. We retain the original PDF and do not
 * invent any coverage statement. Invoice and component arithmetic,
 * rather than a generic CPA paragraph in policy wording, determine
 * the premium-entry buckets.
 */
type Printed={od:number;tp:number;net:number;gst:number;gross:number};
const round2=(n:number)=>Math.round(n*100)/100;
const money=(v:string)=>Number(v.replace(/,/g,""));
const close=(a:number,b:number,tol=.06)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol;
export type NationalGcvRecordEvidence={
  canonical:{od:string;tp:string;addOnPremium:"0";cpa:"0";cpaOpted:"No"};
  roundingAdjustment:number;
  rationale:string;
};
export function assessNationalGcvRecordSource(text:string,p:Printed):NationalGcvRecordEvidence|null{
  const whole=text.replace(/\r/g,"").replace(/\u00a0/g," ");
  // National bilingual certificates may interleave Hindi glyphs and line breaks
  // between the goods-carrying title and Package. Bound that gap tightly;
  // do not accept unrelated National products or invoices.
  if(!/National Insurance Co(?:mpany)?\.?\s*(?:Ltd|Limited)/i.test(whole)
    ||!/Policy Schedule-Motor\s*-\s*Goods Carrying Vehicle\s*-[\s\S]{0,90}?\bPackage\b/i.test(whole)
    ||!/Commercial Vehicle Package Policy/i.test(whole))
    return null;
  const invoiceStart=whole.search(/TAX INVOICE/i);
  if(invoiceStart<0)return null;
  // Restrict source proof to the invoice, not boilerplate in the annexures.
  const invoice=whole.slice(invoiceStart,invoiceStart+5500).replace(/\s+/g," ");
  const number=(v:string)=>money(v);
  // Exact labelled product/invoice row sequence. The two separate tax rates
  // must agree with component premium AND the separately printed tax total.
  let rows=[...invoice.matchAll(/997134\s+Motor(?:\s+vehicle\s+insurance\s+services)?\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+0%\s+0\.00\s+0%\s+0\.00\s+(18|5)%\s+([\d,]+\.\d{2})/gi)]
    .map(x=>({gross:number(x[1]),taxable:number(x[2]),rate:Number(x[3]),igst:number(x[4])}));
  if(rows.length!==2){
    // PDF.js may return the ten-page invoice in column-major order:
    // two SAC rows, then taxable values, then the rate/tax columns.
    // Reconstruct ONLY if there is exactly one mathematical pairing of
    // independently printed taxable values, tax rates and IGST amounts.
    const section=invoice.slice(invoice.indexOf("997134"));
    if(!section||[...section.matchAll(/\b997134\b/g)].length!==2
      ||[...section.matchAll(/\b18%/g)].length!==1
      ||[...section.matchAll(/\b5%/g)].length!==1)return null;
    const monetary=[...section.matchAll(/\b([\d,]+\.\d{2})\b/g)].map(m=>number(m[1]));
    const counts=new Map<number,number>();
    for(const n of monetary)counts.set(n,(counts.get(n)??0)+1);
    const bases=[...counts].filter(([n,count])=>count>=2&&n>0&&n<p.net+1).map(([n])=>n);
    const candidates:typeof rows=[];
    for(const highBase of bases)for(const lowBase of bases){
      if(highBase===lowBase||highBase<=p.od||lowBase>=p.tp
        ||Math.abs(highBase+lowBase-p.net)>.05)continue;
      const highTax=Math.round(highBase*.18),lowTax=Math.round(lowBase*.05);
      if(highTax+lowTax!==p.gst||!counts.has(highTax)||!counts.has(lowTax))continue;
      candidates.push(
        {gross:highBase,taxable:highBase,rate:18,igst:highTax},
        {gross:lowBase,taxable:lowBase,rate:5,igst:lowTax},
      );
    }
    if(candidates.length!==2)return null;
    rows=candidates;
  }
  const high=rows.find(r=>r.rate===18),low=rows.find(r=>r.rate===5);
  if(!high||!low||rows.filter(r=>r.rate===18).length!==1||rows.filter(r=>r.rate===5).length!==1)return null;
  const od=whole.match(/\/Own[\s\S]{0,240}?Damage Cover[\s\S]{0,145}?₹\s*([\d,.]+)/i);
  const basic=whole.match(/Legal Liability Cover\s+([\d,.]+)/i);
  // National's native PDF can print the count of covered paid employees
  // between the liability label and its amount:
  //   Legal Liability to Driver,Cleaner,Coolies
  //   (Upto 6) 2-pers.
  //   100.00
  //   CNG/LPG Kit
  // Accept only this exact source row shape or the older directly itemized
  // amount. A random number elsewhere in the schedule must never count.
  const paid=whole.match(/Legal Liability to Driver,Cleaner,Coolies\s+([\d,.]+)\b/i)
    ||whole.match(/Legal Liability to Driver,Cleaner,Coolies\s+\(Upto\s*6\)\s+\d+-pers\.\s+([\d,.]+)(?=\s+CNG\/LPG Kit)/i);
  // Invoice and the already-passed n8n 18/18 contract are the baseline.
  // Native PDF row placement may separate the amount from its printed
  // label; never infer a charge from a generic owner-driver paragraph.
  if(!/Own[\s\S]{0,300}?Damage Cover/i.test(whole)
    ||!/Legal Liability Cover/i.test(whole)
    ||!/Legal Liability to Driver,Cleaner,Coolies/i.test(whole))return null;
  const sourceOd=od?money(od[1]):p.od;
  const basicTp=basic?money(basic[1]):low.taxable;
  const inferredDriver=p.tp-low.taxable;
  // If PDF.js separates columns, locate the charge in the bounded
  // paid-driver row itself; an amount inferred only from the GST totals
  // is not enough. Never use numbers from a later invoice/coverage page.
  const driverLabel=whole.indexOf("Legal Liability to Driver,Cleaner,Coolies");
  const nextLabel=whole.indexOf("CNG/LPG Kit",driverLabel);
  const chargeRow=driverLabel>=0
    ?whole.slice(driverLabel,nextLabel>driverLabel&&nextLabel-driverLabel<520
      ?nextLabel:driverLabel+400):"";
  const sourceCharge=new RegExp("(?:^|[^\\d])"+inferredDriver.toFixed(2).replace(".","\\.")+"(?:$|[^\\d])");
  if(!paid&&!sourceCharge.test(chargeRow))return null;
  const paidDriver=paid?money(paid[1]):inferredDriver;
  if(![p.od,p.tp,p.net,p.gst,p.gross,sourceOd,basicTp,paidDriver].every(x=>Number.isFinite(x)&&x>=0)
    ||paidDriver<=0||basicTp<=0
    ||!close(sourceOd,p.od,.001)||!close(basicTp+paidDriver,p.tp,.001)
    ||!close(high.gross,high.taxable,.001)||!close(low.gross,low.taxable,.001)
    ||!close(high.taxable,sourceOd+paidDriver,.001)
    ||!close(low.taxable,basicTp,.001)
    ||!close(Math.round(high.taxable*.18),high.igst,1)
    ||!close(Math.round(low.taxable*.05),low.igst,1)
    ||!close(high.igst+low.igst,p.gst,.001)
    ||!close(p.net+p.gst,p.gross,.001)
    ||!close(sourceOd+p.tp,p.net,.05))
    return null;
  // Canonical motor ledger holds OD+TP+CPA=net; keep printed TP unchanged,
  // allocate the insurer's <=5-paisa NET rounding into its OD bucket.
  // Original OD and invoice tax bases are preserved in the source PDF.
  const rounding=round2(p.net-(p.od+p.tp));
  if(Math.abs(rounding)>.05)return null;
  const canonicalOd=round2(p.net-p.tp);
  if(canonicalOd<=0||!close(canonicalOd+p.tp,p.net,.001))return null;
  return{
    canonical:{od:String(canonicalOd),tp:String(p.tp),addOnPremium:"0",cpa:"0",cpaOpted:"No"},
    roundingAdjustment:rounding,
    rationale:"National GCV invoice: 18% source OD+paid-driver LL, 5% Basic TP, no separate owner-driver CPA charge. CPA cover/waiver is not asserted; original PDF preserved.",
  };
}
