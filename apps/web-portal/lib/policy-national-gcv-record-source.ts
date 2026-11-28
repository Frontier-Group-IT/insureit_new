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
  if(!/National Insurance Co(?:mpany)?\.?\s*(?:Ltd|Limited)/i.test(whole)
    ||!/Policy Schedule-Motor\s*-\s*Goods Carrying Vehicle\s*-\s*Package/i.test(whole)
    ||!/Commercial Vehicle Package Policy/i.test(whole))
    return null;
  const invoiceStart=whole.search(/TAX INVOICE/i);
  if(invoiceStart<0)return null;
  // Restrict source proof to the invoice, not boilerplate in the annexures.
  const invoice=whole.slice(invoiceStart,invoiceStart+5500).replace(/\s+/g," ");
  const number=(v:string)=>money(v);
  // Exact labelled product/invoice row sequence. The two separate tax rates
  // must agree with component premium AND the separately printed tax total.
  const rows=[...invoice.matchAll(/997134\s+Motor\s+vehicle\s+insurance\s+services\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+0%\s+0\.00\s+0%\s+0\.00\s+(18|5)%\s+([\d,]+\.\d{2})/gi)]
    .map(x=>({gross:number(x[1]),taxable:number(x[2]),rate:Number(x[3]),igst:number(x[4])}));
  if(rows.length!==2)return null;
  const high=rows.find(r=>r.rate===18),low=rows.find(r=>r.rate===5);
  if(!high||!low||rows.filter(r=>r.rate===18).length!==1||rows.filter(r=>r.rate===5).length!==1)return null;
  const od=whole.match(/Own\s*\nDamage Cover[\s\S]{0,145}?₹\s*([\d,.]+)/i);
  const basic=whole.match(/Legal Liability Cover\s+([\d,.]+)/i);
  const paid=whole.match(/Legal Liability to Driver,Cleaner,Coolies[\s\S]{0,100}?\n\s*([\d,.]+)\s*\nCNG\/LPG Kit/i);
  if(!od||!basic||!paid)return null;
  const sourceOd=money(od[1]),basicTp=money(basic[1]),paidDriver=money(paid[1]);
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
