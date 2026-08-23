import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type AccountsReportQuery={period?:string;from?:string;to?:string;insurer?:string};
export type AccountsReportFilters={period:"90d"|"mtd"|"ytd"|"all"|"custom";fromDate:string|null;toDate:string|null;insurerId:string|null};
export type AgingBucket={current:number;d1_30:number;d31_60:number;d61_90:number;d90_plus:number};
export type AccountsReport={
 summary:{recognized:number;invoiced:number;bank_receipts:number;tds:number;outstanding:number;partner_agreed:number;partner_paid:number;partner_outstanding:number;gross_contribution:number;variance:number};
 counts:{finalized_reconciliation:number;unmatched_reconciliation:number;pending_reconciliation:number;open_invoices:number;tds_pending:number;tds_mismatch:number;open_partner_payables:number;closed_periods:number};
 aging:AgingBucket;
 insurers:Array<{id:string;name:string;recognized:number;invoiced:number;bank_receipts:number;tds:number;outstanding:number;variance:number}>;
 invoices:Array<{id:string;invoice_no:string;invoice_date:string|null;due_date:string|null;status:string;gross:number;outstanding:number;insurer_name:string}>;
 reconciliation:Array<{id:string;policy_no:string;recognized:number;adjustment:number;variance:number;review_status:string;match_status:string;insurer_name:string;period_end:string}>;
 partner:Array<{id:string;intermediary_code:string;status:string;agreed:number;outstanding:number;policy_no:string}>;
 periods:Array<{id:string;period_start:string;period_end:string;status:string;closed_at:string|null;reopened_at:string|null}>;
 filters:{insurers:Array<{id:string;name:string}>};
};

type Raw=Record<string,unknown>;
const money=(v:unknown)=>{const n=Number(v??0);return Number.isFinite(n)?Math.round(n*100)/100:0};
const one=<T>(v:T|T[]|null|undefined):T|null=>Array.isArray(v)?(v[0]??null):(v??null);

export async function loadAccountsReport(query:AccountsReportQuery){
 const filters=resolveAccountsReportFilters(query);const db=createSupabaseAdminClient();
 const [insurersRes,reconRes,invoicesRes,receiptsRes,tdsRes,payoutsRes,payablesRes,paymentsRes,periodsRes]=await Promise.all([
  db.from("insurance_companies").select("id,name").order("name"),
  db.from("reconciliation_lines").select("id,policy_id,input_policy_no,match_status,review_status,actual_recognized_payin,adjustment_amount,variance_amount,reconciliation_cycles!inner(insurer_id,status,period_start,period_end,accounting_period_start,accounting_period_end),policies(policy_no)").order("created_at",{ascending:false}).limit(10000),
  db.from("accounts_invoices").select("id,insurer_id,invoice_no,invoice_date,due_date,status,gross_invoice_amount,outstanding_amount").order("invoice_date",{ascending:false}).limit(10000),
  db.from("accounts_receipts").select("id,insurer_id,receipt_date,bank_amount").order("receipt_date",{ascending:false}).limit(10000),
  db.from("accounts_tds_entries").select("id,insurer_id,invoice_id,tds_date,tds_amount,matched_status").order("tds_date",{ascending:false}).limit(10000),
  db.from("policy_intermediary_payouts").select("id,policy_id,gross_payout,commercial_status").limit(10000),
  db.from("partner_payables").select("id,policy_id,intermediary_code,status,agreed_amount,outstanding_amount,created_at,policies(policy_no)").order("created_at",{ascending:false}).limit(10000),
  db.from("partner_payments").select("id,payment_date,payment_amount").order("payment_date",{ascending:false}).limit(10000),
  db.from("accounting_periods").select("id,period_start,period_end,status,closed_at,reopened_at").order("period_start",{ascending:false}).limit(120),
 ]);
 const error=[insurersRes.error,reconRes.error,invoicesRes.error,receiptsRes.error,tdsRes.error,payoutsRes.error,payablesRes.error,paymentsRes.error,periodsRes.error].find(Boolean);if(error)throw new Error(error.message);
 const insurerOptions=(insurersRes.data??[]).map(x=>({id:String(x.id),name:String(x.name??"")}));const insurerName=new Map(insurerOptions.map(x=>[x.id,x.name]));
 const inRange=(date:string|null|undefined)=>!date?false:(!filters.fromDate||date>=filters.fromDate)&&(!filters.toDate||date<=filters.toDate);
 const insurerOk=(id:string|null|undefined)=>!filters.insurerId||id===filters.insurerId;

 const finalized=(reconRes.data??[]).filter(row=>{const cycle=one(row.reconciliation_cycles as Raw|Raw[]|null);const end=String(cycle?.accounting_period_end??cycle?.period_end??"");return row.match_status==="Matched"&&["Accepted","Resolved"].includes(String(row.review_status))&&["Reconciled","Closed"].includes(String(cycle?.status))&&insurerOk(String(cycle?.insurer_id??""))&&(filters.period==="all"||inRange(end));});
 const recognizedPolicyIds=new Set(finalized.map(r=>String(r.policy_id??"")).filter(Boolean));
 const actualPartnerPayout=(payoutsRes.data??[]).filter(p=>recognizedPolicyIds.has(String(p.policy_id??""))&&["entered","reviewed"].includes(String(p.commercial_status))).reduce((s,p)=>s+money(p.gross_payout),0);
 const recognized=finalized.reduce((s,r)=>s+money(r.actual_recognized_payin)+money(r.adjustment_amount),0);const variance=finalized.reduce((s,r)=>s+money(r.variance_amount),0);

 const invoices=(invoicesRes.data??[]).filter(r=>insurerOk(String(r.insurer_id??""))&&(filters.period==="all"||inRange(r.invoice_date)));
 const raisedInvoices=invoices.filter(r=>!["Draft","Cancelled"].includes(String(r.status)));
 const receipts=(receiptsRes.data??[]).filter(r=>insurerOk(String(r.insurer_id??""))&&(filters.period==="all"||inRange(r.receipt_date)));
 const tds=(tdsRes.data??[]).filter(r=>insurerOk(String(r.insurer_id??""))&&(filters.period==="all"||inRange(r.tds_date)));
 const payables=(payablesRes.data??[]).filter(r=>filters.period==="all"||inRange(String(r.created_at??"").slice(0,10)));
 const payments=(paymentsRes.data??[]).filter(r=>filters.period==="all"||inRange(r.payment_date));
 const openInvoices=raisedInvoices.filter(r=>["Raised","Partially Received"].includes(String(r.status))&&money(r.outstanding_amount)>0);
 const aging: AgingBucket={current:0,d1_30:0,d31_60:0,d61_90:0,d90_plus:0};const asOf=filters.toDate??indiaDate(new Date());
 for(const r of openInvoices){const due=String(r.due_date??r.invoice_date??asOf);const days=Math.floor((Date.parse(`${asOf}T00:00:00Z`)-Date.parse(`${due}T00:00:00Z`))/86400000);const amount=money(r.outstanding_amount);if(days<=0)aging.current+=amount;else if(days<=30)aging.d1_30+=amount;else if(days<=60)aging.d31_60+=amount;else if(days<=90)aging.d61_90+=amount;else aging.d90_plus+=amount;}

 const byInsurer=new Map<string,{id:string;name:string;recognized:number;invoiced:number;bank_receipts:number;tds:number;outstanding:number;variance:number}>();
 const touch=(id:string)=>{let x=byInsurer.get(id);if(!x){x={id,name:insurerName.get(id)??"Unassigned",recognized:0,invoiced:0,bank_receipts:0,tds:0,outstanding:0,variance:0};byInsurer.set(id,x)}return x};
 for(const r of finalized){const cycle=one(r.reconciliation_cycles as Raw|Raw[]|null);const x=touch(String(cycle?.insurer_id??""));x.recognized=money(x.recognized+money(r.actual_recognized_payin)+money(r.adjustment_amount));x.variance=money(x.variance+money(r.variance_amount));}
 for(const r of raisedInvoices){const x=touch(String(r.insurer_id));x.invoiced=money(x.invoiced+money(r.gross_invoice_amount));x.outstanding=money(x.outstanding+money(r.outstanding_amount));}
 for(const r of receipts){touch(String(r.insurer_id)).bank_receipts=money(touch(String(r.insurer_id)).bank_receipts+money(r.bank_amount));}
 for(const r of tds){touch(String(r.insurer_id)).tds=money(touch(String(r.insurer_id)).tds+money(r.tds_amount));}

 const reconRows=finalized.slice(0,250).map(r=>{const c=one(r.reconciliation_cycles as Raw|Raw[]|null);const p=one(r.policies as Raw|Raw[]|null);return{id:String(r.id),policy_no:String(p?.policy_no??r.input_policy_no??""),recognized:money(r.actual_recognized_payin),adjustment:money(r.adjustment_amount),variance:money(r.variance_amount),review_status:String(r.review_status??""),match_status:String(r.match_status??""),insurer_name:insurerName.get(String(c?.insurer_id??""))??"",period_end:String(c?.accounting_period_end??c?.period_end??"")};});
 const partnerRows=payables.slice(0,250).map(r=>({id:String(r.id),intermediary_code:String(r.intermediary_code??""),status:String(r.status??""),agreed:money(r.agreed_amount),outstanding:money(r.outstanding_amount),policy_no:String(one(r.policies as Raw|Raw[]|null)?.policy_no??"")}));
 const report:AccountsReport={
  summary:{recognized:money(recognized),invoiced:money(raisedInvoices.reduce((s,r)=>s+money(r.gross_invoice_amount),0)),bank_receipts:money(receipts.reduce((s,r)=>s+money(r.bank_amount),0)),tds:money(tds.reduce((s,r)=>s+money(r.tds_amount),0)),outstanding:money(openInvoices.reduce((s,r)=>s+money(r.outstanding_amount),0)),partner_agreed:money(actualPartnerPayout),partner_paid:money(payments.reduce((s,r)=>s+money(r.payment_amount),0)),partner_outstanding:money(payables.reduce((s,r)=>s+money(r.outstanding_amount),0)),gross_contribution:money(recognized-actualPartnerPayout),variance:money(variance)},
  counts:{finalized_reconciliation:finalized.length,unmatched_reconciliation:(reconRes.data??[]).filter(r=>r.match_status==="Unmatched").length,pending_reconciliation:(reconRes.data??[]).filter(r=>["Pending","Follow-up"].includes(String(r.review_status))).length,open_invoices:openInvoices.length,tds_pending:tds.filter(r=>r.matched_status==="Pending").length,tds_mismatch:tds.filter(r=>r.matched_status==="Mismatch").length,open_partner_payables:payables.filter(r=>!["Paid","Closed"].includes(String(r.status))).length,closed_periods:(periodsRes.data??[]).filter(r=>r.status==="Closed").length},
  aging,
  insurers:[...byInsurer.values()].sort((a,b)=>b.recognized-a.recognized),
  invoices:invoices.slice(0,250).map(r=>({id:String(r.id),invoice_no:String(r.invoice_no??""),invoice_date:r.invoice_date?String(r.invoice_date):null,due_date:r.due_date?String(r.due_date):null,status:String(r.status??""),gross:money(r.gross_invoice_amount),outstanding:money(r.outstanding_amount),insurer_name:insurerName.get(String(r.insurer_id??""))??""})),
  reconciliation:reconRows,partner:partnerRows,
  periods:(periodsRes.data??[]).map(r=>({id:String(r.id),period_start:String(r.period_start),period_end:String(r.period_end),status:String(r.status),closed_at:r.closed_at?String(r.closed_at):null,reopened_at:r.reopened_at?String(r.reopened_at):null})),
  filters:{insurers:insurerOptions}
 };
 return{report,filters};
}

export function resolveAccountsReportFilters(query:AccountsReportQuery):AccountsReportFilters{const period=isPeriod(query.period)?query.period:"mtd";const today=indiaDate(new Date());const base=new Date(`${today}T00:00:00+05:30`);let fromDate:string|null=null;let toDate:string|null=today;if(period==="90d")fromDate=indiaDate(addDays(base,-89));if(period==="mtd")fromDate=`${today.slice(0,8)}01`;if(period==="ytd")fromDate=`${today.slice(0,4)}-01-01`;if(period==="all"){fromDate=null;toDate=null}if(period==="custom"){fromDate=validDate(query.from);toDate=validDate(query.to)}if(fromDate&&toDate&&fromDate>toDate)[fromDate,toDate]=[toDate,fromDate];return{period,fromDate,toDate,insurerId:validUuid(query.insurer)}}
function isPeriod(v:string|undefined):v is AccountsReportFilters["period"]{return v==="90d"||v==="mtd"||v==="ytd"||v==="all"||v==="custom"}function validDate(v:string|undefined){return v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null}function validUuid(v:string|undefined){return v&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)?v:null}function addDays(d:Date,n:number){const x=new Date(d);x.setDate(x.getDate()+n);return x}function indiaDate(d:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(d)}