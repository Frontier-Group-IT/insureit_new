import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getAccessibleIntermediaryApplicationIds } from "@/lib/employee-access-scope";
import { requirePospMispManager } from "@/lib/master-data-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { buildIntermediaryDocumentSlots } from "@/lib/intermediary-document-slots";
import { PospMispQueueWorkspace } from "./posp-misp-queue-workspace";

type QueueRow = { id:string; partner_type:"posp"|"misp"; source:string; status:string; applicant_phone:string|null; applicant_name:string|null; city:string|null; external_onboarding_id:string|null; document_count:number; age_days:number; updated_at:string; total_count:number; missing_required_count?:number };
type QueueApplication = { id:string; draft_data:Record<string,unknown>|null; partner_status:string|null; registration_status:string|null; final_type:string|null };
type QueueProfile = { application_id:string; workflow_stage:string|null; gst_number:string|null };
type QueueDocument = { application_id:string; document_type:string; file_name:string; document_label:string|null };
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
 const [{data:applications,error:applicationsError},{data:profiles,error:profilesError},{data:documents,error:documentsError}]=fetchedIds.length
  ?await Promise.all([
    supabase.from("intermediary_onboarding_applications").select("id,draft_data,partner_status,registration_status,final_type").in("id",fetchedIds).returns<QueueApplication[]>(),
    supabase.from("posp_misp_onboarding_profiles").select("application_id,workflow_stage,gst_number").in("application_id",fetchedIds).returns<QueueProfile[]>(),
    supabase.from("intermediary_onboarding_documents").select("application_id,document_type,file_name,document_label").in("application_id",fetchedIds).returns<QueueDocument[]>(),
   ])
  :[{data:[] as QueueApplication[],error:null},{data:[] as QueueProfile[],error:null},{data:[] as QueueDocument[],error:null}];
 const applicationById=new Map((applications??[]).map(item=>[item.id,item]));
 const profileByApplicationId=new Map((profiles??[]).map(item=>[item.application_id,item]));
 const documentsByApplicationId=new Map<string,QueueDocument[]>();
 for(const document of documents??[]){const current=documentsByApplicationId.get(document.application_id)??[];current.push(document);documentsByApplicationId.set(document.application_id,current)}
 const onboardingRows=fetchedRows.flatMap(row=>{
  const queueProfile=profileByApplicationId.get(row.id);
  const queueDocuments=documentsByApplicationId.get(row.id)??[];
  const missingRequiredCount=missingRequiredDocuments(queueProfile,queueDocuments);
  return isPendingOnboardingApplication(applicationById.get(row.id),row.status,queueProfile,missingRequiredCount)?[{...row,missing_required_count:missingRequiredCount}]:[];
 });
 const allowedRows=scoped?onboardingRows.filter(row=>accessibleIds.includes(row.id)):onboardingRows;
 const canReview=await hasEffectiveCapability(profile,"review_intermediary_application","edit");
 const loadError=error||applicationsError||profilesError||documentsError;
 return <AppShell title="Pending Intermediary Applications"><div className="mx-auto max-w-[1480px] pb-5">
  {loadError?<DataError message="The pending intermediary application register could not be loaded."/>:<PospMispQueueWorkspace rows={allowedRows} canReview={canReview} initialQuery={q} initialType={typeFilter}/>}
 </div></AppShell>;
}
function isPendingOnboardingApplication(application:QueueApplication|undefined,rowStatus:string,profile:QueueProfile|undefined,missingRequiredCount:number){
 if(!application||!profile||!OPEN_STATUSES.has(rowStatus))return false;
 if(application.partner_status==="active_partner")return false;
 if(accountContext(application.draft_data)!=="partner")return false;
 if(application.final_type==="partner")return false;
 if(profile.workflow_stage!=="iib_processing")return false;
 if((application.registration_status?.trim().toLowerCase()??"")!=="documents_pending")return false;
 return missingRequiredCount>0;
}
function missingRequiredDocuments(profile:QueueProfile|undefined,documents:QueueDocument[]){
 if(!profile)return 0;
 const slots=buildIntermediaryDocumentSlots({legacy:false,hasGst:Boolean(profile.gst_number?.trim()),documents});
 return slots.filter(slot=>slot.required).filter(slot=>!documents.some(document=>document.document_type===slot.key&&Boolean(document.file_name?.trim()))).length;
}
function accountContext(draft:Record<string,unknown>|null|undefined){const context=draft?.account_context;return context==="posp"||context==="misp"?context:"partner"}
