import { getCurrentSession } from '@/lib/partner-session';

const portal = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');

export type NativeProductType = 'Motor' | 'Life' | 'Health' | 'Non Motor';
export type NativeProductDrafts = Partial<Record<Exclude<NativeProductType, 'Motor'>, Record<string, string>>>;

export type NativePolicyDraft = {
  /** Isolated non-Motor drafts: never copy Life/Health/Risk values into Motor booking. */
  productDrafts?: NativeProductDrafts;
  registrationMode: 'registered' | 'unregistered';
  issuanceDate: string; rmName: string; intermediaryType: string; leadSource: string; intermediaryCode: string; businessLine: string;
  registrationNo: string; insuredName: string; phoneNo: string; vehicleClass: string; make: string; model: string; fuelType: string;
  capacity: string; manufacturingYear: string; chassisNo: string; engineNo: string; rtoState: string; rtoName: string;
  policyProduct: string; idv: string; od: string; tp: string; cpaOpted: 'Yes' | 'No'; cpa: string;
  policyNo: string; insurerId: string; validFrom: string; validUpto: string; addOnPremium?: string; tpValidUpto?: string; cpaValidUpto?: string;
  payoutBasis: string; projectedOdPercent: string; projectedTpPercent: string; insurerScheme: string; payinBillNo: string; payinBilledAmount: string; payinBillDate: string; payinStatus: string; retention: string; payoutOdPercent: string; payoutTpPercent: string; flatPayoutAmount: string; payoutStatus: string; payoutDate: string; payoutVoucherNo: string; remarks: string;
};
export type NativeOnboardingData = { draft: NativePolicyDraft; revision: number; intake_number: string; insurers: {value:string;label:string}[]; manufacturers: string[]; sourceMeta?: {name:string;code:string;mobile:string;rmName:string;rmCode:string;rmMobile:string}|null; commercialAccess:boolean; approvers:{key:string;name:string}[] };
async function request<T>(body: Record<string, unknown>): Promise<T> {
  const session = await getCurrentSession();
  if (!session?.access_token) throw new Error('Your Partner session has expired. Sign in again.');
  let response: Response;
  try {
    response = await fetch(`${portal}/api/partner/policy-intakes/native-onboarding`, {
      method: 'POST', cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Cannot reach Policy Onboarding. Check your connection.');
  }
  const result = await response.json().catch(() => null) as ({ok?: boolean;error?: string} & Partial<T>) | null;
  if (!response.ok || !result?.ok) throw new Error(result?.error || `Policy Onboarding unavailable (HTTP ${response.status}).`);
  return result as T;
}
export async function prepareNativePolicyOnboarding(intakeId: string, takeOver = false, expectedReviewerId: string | null = null) {
  return request<NativeOnboardingData>({ action: 'prepare', intake_id: intakeId, take_over: takeOver, expected_reviewer_id: expectedReviewerId });
}
export type NativeNonMotorCustomer = {id:string;name:string;contactName:string;phone:string;email:string};
export async function searchNativeNonMotorCustomers(intakeId:string,search:string){
  return request<{customers:NativeNonMotorCustomer[]}>({
    action:'customer_search',intake_id:intakeId,search,
  });
}
export async function saveNativePolicyOnboarding(intakeId: string, revision: number, draft: NativePolicyDraft) {
  return request<{revision:number}>({ action: 'save', intake_id: intakeId, revision, draft });
}

export type NativePolicyBookingResult =
  | {ok:true;policyId:string;policyCode:string;customerId:string;vehicleId:string;status:'active'}
  | {ok:false;kind:'validation'|'database'|'permission';error:string}
  | {ok:false;kind:'customer_match';candidates:{id:string;name:string;phone:string;phoneMatch:boolean;nameMatch:boolean}[]}
  | {ok:false;kind:'ownership_conflict';conflict:{customerName:string;registrationNumber:string;customerId:string;canTransfer:boolean}}
  | {ok:false;kind:'business_conflict';conflict:{type:string;message?:string;existingPolicyNo?:string;existingVehicleNo?:string;enteredMake?:string;gapDays?:number;existingVehicleId?:string}};

export async function bookNativePolicyOnboarding(
  intakeId:string,
  revision:number,
  resolution?:Record<string,unknown>,
  dateApprovalId?:string|null,
){
  return request<{booking:NativePolicyBookingResult}>({
    action:'book',intake_id:intakeId,revision,resolution,date_approval_id:dateApprovalId??null,
  });
}

export async function createNativeLifeHealthCase(intakeId:string,revision:number){
  return request<{case:{id:string;number:string;status:'awaiting_policy'}}>({
    action:'create_life_health',intake_id:intakeId,revision,
  });
}

export async function requestNativePolicyDateApproval(intakeId:string,revision:number,approverKey:string){
  return request<{approval_id:string;expires_at:string}>({action:'approval_request',intake_id:intakeId,revision,approver_key:approverKey});
}
export async function verifyNativePolicyDateApproval(intakeId:string,revision:number,approvalId:string,otp:string){
  return request<{verified:boolean}>({action:'approval_verify',intake_id:intakeId,revision,approval_id:approvalId,otp});
}

export type NativeRcReview={
  registrationNumber:string;ownerName:string|null;mobileNumber:string|null;vehicleClass:string|null;
  make:string|null;model:string|null;fuelType:string|null;manufacturingYear:string|null;
  engineCapacity:string|null;seatingCapacity:string|null;grossWeight:string|null;
  chassisNumber:string|null;engineNumber:string|null;rtoName:string|null;rtoState:string|null;
};
export async function lookupNativePolicyRc(intakeId:string,registrationNumber:string){
  return request<{review:NativeRcReview}>({action:'rc_lookup',intake_id:intakeId,registration_no:registrationNumber});
}

export type NativeOnboardingDocumentType = 'policy_copy'|'proposal_form'|'kyc'|'other_document';
export type NativeOnboardingDocument = {type:NativeOnboardingDocumentType;fileName:string};
async function documentRequest<T>(intakeId:string,line:NativeProductType,method:'GET'|'POST'|'DELETE',type?:NativeOnboardingDocumentType,file?:{uri:string;name:string;mimeType?:string}):Promise<T>{
  const session=await getCurrentSession();
  if(!session?.access_token)throw new Error('Partner session expired. Sign in again.');
  const endpoint=`${portal}/api/partner/policy-intakes/native-onboarding/documents`;
  const query=`?intake_id=${encodeURIComponent(intakeId)}&business_line=${encodeURIComponent(line)}`;
  const headers:Record<string,string>={Authorization:`Bearer ${session.access_token}`};
  let body:FormData|string|undefined;
  if(method==='POST'&&type&&file){
    const multipart=new FormData();
    multipart.append('intake_id',intakeId);
    multipart.append('business_line',line);
    multipart.append('document_type',type);
    // React Native FormData accepts file URIs; the browser/OS supplies the binary body.
    multipart.append('file',{uri:file.uri,name:file.name,type:file.mimeType||'application/octet-stream'} as unknown as Blob);
    body=multipart;
  }else if(method==='DELETE'){
    headers['Content-Type']='application/json';
    body=JSON.stringify({intake_id:intakeId,business_line:line,document_type:type});
  }
  let response:Response;
  try{response=await fetch(endpoint+(method==='GET'?query:''),{method,headers,body,cache:'no-store'});}
  catch{throw new Error('Document service is unavailable. Check your connection.');}
  const value=await response.json().catch(()=>null) as ({ok?:boolean;error?:string}&Partial<T>)|null;
  if(!response.ok||!value?.ok)throw new Error(value?.error||'Document could not be saved.');
  return value as T;
}
export async function listNativeOnboardingDocuments(intakeId:string,line:NativeProductType){
  return documentRequest<{documents:NativeOnboardingDocument[]}>(intakeId,line,'GET');
}
export async function uploadNativeOnboardingDocument(intakeId:string,line:NativeProductType,type:NativeOnboardingDocumentType,file:{uri:string;name:string;mimeType?:string}){
  return documentRequest<{document:NativeOnboardingDocument}>(intakeId,line,'POST',type,file);
}
export async function deleteNativeOnboardingDocument(intakeId:string,line:NativeProductType,type:NativeOnboardingDocumentType){
  return documentRequest<{ok:true}>(intakeId,line,'DELETE',type);
}

/** Standalone policy creation never reads, claims, or writes a Policy Intake. */
export async function prepareNewNativePolicyOnboarding(){
  return request<NativeOnboardingData>({action:'new_prepare'});
}
export async function bookNewNativePolicyOnboarding(draft:NativePolicyDraft,resolution?:Record<string,unknown>,dateApprovalId?:string|null){
  return request<{booking:NativePolicyBookingResult}>({action:'new_book',draft,resolution,date_approval_id:dateApprovalId??null});
}
export async function lookupNewNativePolicyRc(registrationNumber:string){
  return request<{review:NativeRcReview}>({action:'new_rc_lookup',registration_no:registrationNumber});
}
export async function requestNewNativePolicyDateApproval(draft:NativePolicyDraft,approverKey:string){
  return request<{approval_id:string;expires_at:string}>({action:'new_approval_request',draft,approver_key:approverKey});
}
export async function verifyNewNativePolicyDateApproval(draft:NativePolicyDraft,approvalId:string,otp:string){
  return request<{verified:boolean}>({action:'new_approval_verify',draft,approval_id:approvalId,otp});
}

/** Create an independent Life case. Files are held locally and submitted together with the form.
 * No Policy Intake ID, persisted staging row or intake permissions are required.
 */
export async function createNewNativeLifeHealthCase(
  draft:NativePolicyDraft,
  documents:Partial<Record<NativeOnboardingDocumentType,{uri:string;name:string;mimeType?:string}>>,
){
  const session=await getCurrentSession();
  if(!session?.access_token)throw new Error('Your Partner session has expired. Sign in again.');
  const body=new FormData();
  body.append('draft',JSON.stringify(draft));
  const names:Record<NativeOnboardingDocumentType,string>={
    policy_copy:'policyCopy',proposal_form:'proposalForm',kyc:'kyc',other_document:'otherDocument',
  };
  for(const [type,file] of Object.entries(documents) as [NativeOnboardingDocumentType,{uri:string;name:string;mimeType?:string}][]){
    if(file?.uri)body.append(names[type],{uri:file.uri,name:file.name,type:file.mimeType||'application/octet-stream'} as unknown as Blob);
  }
  let response:Response;
  try{response=await fetch(`${portal}/api/partner/policy-intakes/native-onboarding/standalone-life`,{
    method:'POST',cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`},body,
  });}catch{throw new Error('Cannot reach Life/Health Policy Onboarding. Check your connection.');}
  const result=await response.json().catch(()=>null) as {ok?:boolean;error?:string;case?:{id:string;number:string;status:'awaiting_policy'}}|null;
  if(!response.ok||!result?.ok||!result.case)throw new Error(result?.error||'Could not create Life/Health case. Check Case Register before retrying.');
  return {case:result.case};
}

/** Standalone Non-Motor customer lookup is permission-scoped by the backend. */
export async function searchNewNativeNonMotorCustomers(search:string){
  const session=await getCurrentSession();
  if(!session?.access_token)throw new Error('Partner session expired. Sign in again.');
  let response:Response;
  try{
    response=await fetch(`${portal}/api/partner/policy-intakes/native-onboarding/standalone-non-motor?search=${encodeURIComponent(search)}`,{
      cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`},
    });
  }catch{throw new Error('Customer search is unavailable. Check your connection.');}
  const result=await response.json().catch(()=>null) as {ok?:boolean;error?:string;customers?:NativeNonMotorCustomer[]}|null;
  if(!response.ok||!result?.ok)throw new Error(result?.error||'Customer lookup is unavailable.');
  return {customers:result.customers??[]};
}
/** Direct standalone Non-Motor policy booking using the verified Operations engine. */
export async function bookNewNativeNonMotorPolicy(
  draft:NativePolicyDraft,
  documents:Partial<Record<NativeOnboardingDocumentType,{uri:string;name:string;mimeType?:string}>>,
){
  const session=await getCurrentSession();
  if(!session?.access_token)throw new Error('Partner session expired. Sign in again.');
  const body=new FormData();
  body.append('draft',JSON.stringify(draft));
  const names:Record<NativeOnboardingDocumentType,string>={
    policy_copy:'policyCopy',proposal_form:'proposalForm',kyc:'kyc',other_document:'otherDocument',
  };
  for(const [type,file] of Object.entries(documents) as [NativeOnboardingDocumentType,{uri:string;name:string;mimeType?:string}][]){
    if(file?.uri)body.append(names[type],{uri:file.uri,name:file.name,type:file.mimeType||'application/octet-stream'} as unknown as Blob);
  }
  let response:Response;
  try{response=await fetch(`${portal}/api/partner/policy-intakes/native-onboarding/standalone-non-motor`,{
    method:'POST',cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`},body,
  });}catch{throw new Error('Cannot reach Non-Motor onboarding. Check your connection.');}
  const result=await response.json().catch(()=>null) as {ok?:boolean;error?:string;policy?:{id:string;number:string}}|null;
  if(!response.ok||!result?.ok||!result.policy)throw new Error(result?.error||'Booking outcome unknown. Check the Policy Register before retrying.');
  return {policy:result.policy};
}

/** Active intermediary options, scoped to creation permissions and the Intake's fixed source. */
export type NativeLeadSource={id:string;name:string;code:string;mobile:string;rmName:string;rmCode:string};
export async function searchNativeLeadSources(intermediaryType:string,search:string,intakeId?:string,offset=0){
  const session=await getCurrentSession();
  if(!session?.access_token)throw new Error('Partner session expired. Sign in again.');
  let response:Response;
  try{
    response=await fetch(`${portal}/api/partner/policy-intakes/native-onboarding/sources`,{
      method:'POST',cache:'no-store',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},
      body:JSON.stringify({intermediary_type:intermediaryType,search,intake_id:intakeId||undefined,offset}),
    });
  }catch{throw new Error('Lead source lookup is unavailable. Check your connection.');}
  const contentType=response.headers.get('content-type')??'';
  const value=contentType.includes('application/json')?
    await response.json().catch(()=>null) as {ok?:boolean;error?:string;sources?:NativeLeadSource[];hasMore?:boolean}|null:null;
  if(response.status===404||response.status===405){
    throw new Error('Lead Source service is not deployed on the website yet. Ask Operations to publish the website backend before using this dropdown.');
  }
  if(response.status===401)throw new Error('Your Partner session expired. Sign in again.');
  if(response.status===403)throw new Error(value?.error||'Your account cannot access these Lead Sources.');
  if(!response.ok||!value?.ok)throw new Error(value?.error||`Could not load Lead Sources (HTTP ${response.status}). Try again or contact Operations.`);
  return {sources:value.sources??[],hasMore:Boolean(value.hasMore)};
}
