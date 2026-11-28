/**
 * Independently certify a zero *charged* CPA from an issued New India GCV
 * PDF. This is record keeping, not a statement about CPA cover or waiver.
 * It runs only on the original source PDF after the insurer-specific n8n
 * 16-check contract has already passed.
 */
type Premium={od:number;tp:number;net:number;gst:number;gross:number};
const near=(a:number,b:number,tolerance=.01)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
const amount=(s:string)=>Number(s.replace(/,/g,""));
const num=(n:number)=>String(n).replace(/\./g,"\\.");
export const NIA_ZERO_CHARGE_SOURCE="NIA PDF page 2 Owner Driver PA nominee none; no CPA charged; TP and 18%/5% IGST independently reconciled";
export function certifyNiaZeroChargedCpa(text:string,p:Premium):boolean{
  const source=text.replace(/\r/g,"").replace(/\u00a0/g," ");
  if(!/THE NEW INDIA ASSURANCE CO\.\s*LTD\./i.test(source)
    ||!/Commercial Vehicle Package Policy Enhanced Covers/i.test(source)
    ||!/SCHEDULE OF PREMIUM/i.test(source)
    ||!/PA cover for Owner Driver[\s\S]{0,490}?\bnone\s+0\s+none\s+none\s+none\b/i.test(source)
    ||/\(\+\)\s*Compulsory PA Premium for Owner Driver/i.test(source))return false;
  if(!Object.values(p).every(n=>Number.isFinite(n)&&n>=0&&n<=1e9)
    ||p.od<=0||p.tp<=0||p.net<=0||p.gross<=0
    ||!near(p.od+p.tp,p.net)||!near(p.net+p.gst,p.gross))return false;
  const start=source.search(/Premium and GST Details/i);
  if(start<0)return false;
  const tax=source.slice(start,start+1900);
  const rows=[...tax.matchAll(/Premium\s+Rs\s*([\d,]+)\s+SGST\s+0\s+0\s+CGST\s+0\s+0\s+IGST\s+(18|5)\s+([\d,]+)/gi)]
    .map(m=>({base:amount(m[1]),rate:Number(m[2]),tax:amount(m[3])}));
  if(rows.length!==2)return false;
  const high=rows.filter(r=>r.rate===18),low=rows.filter(r=>r.rate===5);
  if(high.length!==1||low.length!==1)return false;
  const driver=p.tp-low[0].base;
  if(driver<=0||!Number.isInteger(driver)
    ||!near(high[0].base,p.od+driver)
    ||!near(high[0].base+low[0].base,p.net)
    ||!near(high[0].tax+low[0].tax,p.gst)
    ||!near(Math.round(high[0].base*.18),high[0].tax,1)
    ||!near(Math.round(low[0].base*.05),low[0].tax,1))return false;
  const a=source.search(/SCHEDULE OF PREMIUM/i),b=source.indexOf("Total Payable in Rs",a);
  if(a<0||b<=a||b-a>2800)return false;
  const schedule=source.slice(a,b);
  // Column-major original PDFs interleave the two numeric columns. The
  // matching values must still be printed near their source labels.
  if(!new RegExp("Basic TP Premium[\\s\\S]{0,480}?\\b"+num(low[0].base)+"\\b","i").test(schedule)
    ||!new RegExp("\\boprn\\b[\\s\\S]{0,210}?\\b"+num(driver)+"\\b","i").test(schedule)
    ||!new RegExp("Total OD Premium\\s*\\(Rs\\)\\s*"+num(p.od)+"\\b","i").test(schedule)
    ||!new RegExp("Total TP Premium\\s*\\(Rs\\)\\s*"+num(p.tp)+"\\b","i").test(schedule)
    ||!new RegExp("Total Payable\\s*\\(Rs\\)[\\s\\S]{0,500}?\\b"+num(p.gross.toLocaleString("en-IN"))+"\\b","i").test(schedule))
    return false;
  return true;
}
