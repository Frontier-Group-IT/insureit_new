import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getAccessibleIntermediaryApplicationIds } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { PospMispQueueWorkspace } from "./posp-misp-queue-workspace";

type QueueRow = { id:string; partner_type:"posp"|"misp"; source:string; status:string; applicant_phone:string|null; applicant_name:string|null; city:string|null; external_onboarding_id:string|null; document_count:number; age_days:number; updated_at:string; total_count:number };
type QueueApplication = { id:string; draft_data:Record<string,unknown>|null; partner_status:string|null; registration_status:string|null; final_type:string|null };
type TypeFilter = "posp"|"misp"|null;
const QUEUE_FETCH_LIMIT=1000;
const OPEN_STATUSES=new Set(["submitted","under_review","changes_requested"]);
export const dynamic="force-dynamic";
export const revalidate=0;

export default async function PospMispPage({searchParams}:{searchParams:Promise<{q?:string;type?:string;page?:string}>}){
 const profile=await requirePospMispManager();
 if(!profile) redirect("/access-denied");
 const query=await searchParams;
 const q=query.q?.trim().slice(0,100)||"";
 const typeFilter:TypeFilter=query.type==="posp"||query.type==="misp"?query.type:null;
 const accessibleIds=await getAccessibleIntermediaryApplicationIds(profile.id,profile.role);
 const scoped=accessibleIds!==null;
 const supabase=await createServerSupabaseClient();
 const {data,error}=await supabase.rpc("get_intermediary_application_queue",{p_query:null,p_requested_type:null,p_status:null,p_page:1,p_page_size:QUEUE_FETCH_LIMIT});
 const fetchedRows=(Array.isArray(data)?data:[]) as QueueRow[];
 const fetchedIds=fetchedRows.map(row=>row.id);
 const {data:applications,error:applicationsError}=fetchedIds.length
  ?await supabase.from("intermediary_onboarding_applications").select("id,draft_data,partner_status,registration_status,final_type").in("id",fetchedIds).returns<QueueApplication[]>()
  :{data:[] as QueueApplication[],error:null};
 const applicationById=new Map((applications??[]).map(item=>[item.id,item]));
 const onboardingRows=fetchedRows.filter(row=>isPendingOnboardingApplication(applicationById.get(row.id),row.status));
 const allowedRows=scoped?onboardingRows.filter(row=>accessibleIds.includes(row.id)):onboardingRows;
 const canReview=await hasEffectiveCapability(profile,"review_intermediary_application","edit");
 const loadError=error||applicationsError;
 return <AppShell title="Intermediary Onboarding"><div className="mx-auto max-w-[1480px] pb-5">
  {loadError?<DataError message="The intermediary onboarding register could not be loaded."/>:<PospMispQueueWorkspace rows={allowedRows} canReview={canReview} initialQuery={q} initialType={typeFilter}/>}
 </div></AppShell>;
}
function isPendingOnboardingApplication(application:QueueApplication|undefined,rowStatus:string){
 if(!application||!OPEN_STATUSES.has(rowStatus))return false;
 if(application.partner_status==="active_partner")return false;
 if(accountContext(application.draft_data)!=="partner")return false;
 if(application.final_type==="partner")return false;
 const registrationStatus=application.registration_status?.trim().toLowerCase()??"";
 if(registrationStatus&&!["documents_pending","pending","not_started"].includes(registrationStatus))return false;
 return true;
}
function accountContext(draft:Record<string,unknown>|null|undefined){const context=draft?.account_context;return context==="posp"||context==="misp"?context:"partner"}
