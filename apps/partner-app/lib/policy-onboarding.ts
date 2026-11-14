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
export type NativeOnboardingData = { draft: NativePolicyDraft; revision: number; intake_number: string; insurers: {value:string;label:string}[]; manufacturers: string[]; sourceMeta?: {name:string;code:string;mobile:string;rmName:string;rmCode:string}|null; commercialAccess:boolean; approvers:{key:string;name:string}[] };
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
