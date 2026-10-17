import type { createSupabaseAdminClient } from "@/lib/supabase-admin";

type Admin = ReturnType<typeof createSupabaseAdminClient>;
type Partner = {id:string;partner_code:string;display_name:string;source_application_id:string|null};
export type GroupPartnerRow = {
 id:string;code:string;name:string;mobile:string;assignedRm:string;status:string;
 customers:number|null;netPremium:number|null;payout:number|null;detailHref:string|null;
};
export async function loadGroupPartnerRegisterRows(admin:Admin, partners:Partner[]):Promise<GroupPartnerRow[]> {
 if (!partners.length) return [];
 const appIds=[...new Set(partners.map(p=>p.source_application_id).filter((v):v is string=>Boolean(v)))];
 const [{data:apps},{data:accounts},{data:metrics,error:metricsError}]=await Promise.all([
  appIds.length?admin.from("intermediary_onboarding_applications").select("id,partner_status,partner_record_id,draft_data,requested_type").in("id",appIds):Promise.resolve({data:[]}),
  appIds.length?admin.from("intermediaries").select("application_id,mobile,account_status,intermediary_type").in("application_id",appIds).eq("intermediary_type","partner"):Promise.resolve({data:[]}),
  admin.rpc("partner_register_business_metrics",{p_partner_ids:partners.map(p=>p.id)})
 ]);
 const applications=new Map((apps??[]).map(a=>[a.id,a]));
 const accountByApp=new Map((accounts??[]).map(a=>[a.application_id,a]));
 const business=new Map(((metrics??[]) as Array<{partner_id:string;customer_count:number|string;net_premium:number|string;payout:number|string}>).map(m=>[m.partner_id,m]));
 return partners.map(p=>{
  const app=p.source_application_id?applications.get(p.source_application_id):null;
  const account=p.source_application_id?accountByApp.get(p.source_application_id):null;
  const data=app?.draft_data as Record<string,unknown>|null|undefined;
  const metric=!metricsError?business.get(p.id):undefined;
  const value=(n:number|string|undefined):number|null=>n===undefined?null:Number(n);
  return {id:p.id,code:p.partner_code,name:p.display_name,mobile:account?.mobile?.replace(/\\D/g,"").slice(-10)??"—",
   assignedRm:typeof data?.associate_name==="string"&&data.associate_name.trim()?data.associate_name:"Not assigned",
   status:app?.partner_status==="active_partner"?"POSP Active":app?.partner_status?"POSP Onboarding":"—",
   customers:value(metric?.customer_count),netPremium:value(metric?.net_premium),payout:value(metric?.payout),
   detailHref:p.source_application_id?`/intermediaries/applications/${p.source_application_id}`:null};
 });
}
