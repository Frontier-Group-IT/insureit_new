import "server-only";
import { getAccessibleCustomerIds, getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type ViewerProfile={id:string;role:string|null};
export type OperationsQuery={horizon?:string;exception?:string;page?:string};
export type OperationsFilters={horizonDays:number;exception:string|null;page:number};
export type OperationsReport={
 summary:{vehicle_count:number;commercial_vehicle_count:number;authbridge_verified_count:number;authbridge_unverified_count:number;vehicles_missing_compliance_data:number;missing_compliance_fields:number;expired_document_count:number;due_document_count:number};
 compliance:Array<{label:string;vehicle_count:number;missing_count:number;expired_count:number;due_count:number;nearest_expiry_date:string|null}>;
 customer_documents:{document_count:number;pending_count:number;rejected_count:number;verified_count:number;customers_with_exceptions:number};
 register:{rows:OperationsRow[];total_count:number;page:number;page_size:number};
};
export type OperationsRow={id:string;customer_id:string;customer_name:string;customer_code:string;vehicle_no:string;vehicle_type:string|null;make:string|null;model:string|null;registration_status:string|null;is_commercial:boolean|null;authbridge_verified:boolean;authbridge_last_verified_at:string|null;fitness_expiry_date:string|null;puc_expiry_date:string|null;road_tax_expiry_date:string|null;national_permit_expiry_date:string|null;local_permit_expiry_date:string|null;missing_compliance_count:number;expired_compliance_count:number;due_compliance_count:number;nearest_expiry_date:string|null};

export async function loadOperationsReport(profile:ViewerProfile,query:OperationsQuery){
 const filters=resolveOperationsFilters(query);
 const [customerIds,scope]=await Promise.all([
  getAccessibleCustomerIds(profile.id,profile.role,"view_reports"),
  getEmployeeAccessScope(profile.id,profile.role,"view_reports")
 ]);
 if(customerIds!==null&&customerIds.length===0)return{report:emptyOperationsReport(filters.page),filters,scopeMode:scope.mode};
 const admin=createSupabaseAdminClient();
 const {data,error}=await admin.rpc("get_operations_compliance_report",{p_customer_ids:customerIds,p_horizon_days:filters.horizonDays,p_exception:filters.exception,p_page:filters.page,p_page_size:25});
 if(error)throw new Error(`Operations report query failed: ${error.message}`);
 return{report:normalizeOperationsReport(data,filters.page),filters,scopeMode:scope.mode};
}

export function resolveOperationsFilters(query:OperationsQuery):OperationsFilters{
 const parsed=Number.parseInt(query.horizon??"90",10);
 const horizonDays=[30,60,90,180,365].includes(parsed)?parsed:90;
 const exception=isException(query.exception)?query.exception:null;
 return{horizonDays,exception,page:positiveInteger(query.page)};
}

function normalizeOperationsReport(value:unknown,page:number):OperationsReport{
 const raw=objectValue(value),summary=objectValue(raw.summary),docs=objectValue(raw.customer_documents),register=objectValue(raw.register);
 return{
  summary:{vehicle_count:numberValue(summary.vehicle_count),commercial_vehicle_count:numberValue(summary.commercial_vehicle_count),authbridge_verified_count:numberValue(summary.authbridge_verified_count),authbridge_unverified_count:numberValue(summary.authbridge_unverified_count),vehicles_missing_compliance_data:numberValue(summary.vehicles_missing_compliance_data),missing_compliance_fields:numberValue(summary.missing_compliance_fields),expired_document_count:numberValue(summary.expired_document_count),due_document_count:numberValue(summary.due_document_count)},
  compliance:arrayValue(raw.compliance).map(row=>{const x=objectValue(row);return{label:stringValue(x.label),vehicle_count:numberValue(x.vehicle_count),missing_count:numberValue(x.missing_count),expired_count:numberValue(x.expired_count),due_count:numberValue(x.due_count),nearest_expiry_date:nullableString(x.nearest_expiry_date)}}),
  customer_documents:{document_count:numberValue(docs.document_count),pending_count:numberValue(docs.pending_count),rejected_count:numberValue(docs.rejected_count),verified_count:numberValue(docs.verified_count),customers_with_exceptions:numberValue(docs.customers_with_exceptions)},
  register:{rows:arrayValue(register.rows).map(normalizeRow),total_count:numberValue(register.total_count),page:numberValue(register.page)||page,page_size:numberValue(register.page_size)||25}
 };
}
function normalizeRow(row:unknown):OperationsRow{const x=objectValue(row);return{id:stringValue(x.id),customer_id:stringValue(x.customer_id),customer_name:stringValue(x.customer_name),customer_code:stringValue(x.customer_code),vehicle_no:stringValue(x.vehicle_no),vehicle_type:nullableString(x.vehicle_type),make:nullableString(x.make),model:nullableString(x.model),registration_status:nullableString(x.registration_status),is_commercial:typeof x.is_commercial==="boolean"?x.is_commercial:null,authbridge_verified:Boolean(x.authbridge_verified),authbridge_last_verified_at:nullableString(x.authbridge_last_verified_at),fitness_expiry_date:nullableString(x.fitness_expiry_date),puc_expiry_date:nullableString(x.puc_expiry_date),road_tax_expiry_date:nullableString(x.road_tax_expiry_date),national_permit_expiry_date:nullableString(x.national_permit_expiry_date),local_permit_expiry_date:nullableString(x.local_permit_expiry_date),missing_compliance_count:numberValue(x.missing_compliance_count),expired_compliance_count:numberValue(x.expired_compliance_count),due_compliance_count:numberValue(x.due_compliance_count),nearest_expiry_date:nullableString(x.nearest_expiry_date)}}
export function emptyOperationsReport(page=1):OperationsReport{return{summary:{vehicle_count:0,commercial_vehicle_count:0,authbridge_verified_count:0,authbridge_unverified_count:0,vehicles_missing_compliance_data:0,missing_compliance_fields:0,expired_document_count:0,due_document_count:0},compliance:[],customer_documents:{document_count:0,pending_count:0,rejected_count:0,verified_count:0,customers_with_exceptions:0},register:{rows:[],total_count:0,page,page_size:25}}}
function isException(v:string|undefined){return v==="all"||v==="missing"||v==="expired"||v==="due"||v==="unverified"}
function positiveInteger(v:string|undefined){const x=Number.parseInt(v??"1",10);return Number.isFinite(x)&&x>0?x:1}
function arrayValue(v:unknown):unknown[]{return Array.isArray(v)?v:[]}
function objectValue(v:unknown):Record<string,unknown>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{} }
function stringValue(v:unknown){return typeof v==="string"?v:v==null?"":String(v)}
function nullableString(v:unknown){const x=stringValue(v).trim();return x||null}
function numberValue(v:unknown){const x=typeof v==="number"?v:Number(v??0);return Number.isFinite(x)?x:0}
