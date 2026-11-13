import { getCurrentSession } from '@/lib/partner-session';

const portal = (process.env.EXPO_PUBLIC_PORTAL_URL || 'https://portal.insureit.in').replace(/\/$/, '');

export type NativePolicyDraft = {
  registrationMode: 'registered' | 'unregistered';
  issuanceDate: string; rmName: string; intermediaryType: string; leadSource: string; intermediaryCode: string; businessLine: string;
  registrationNo: string; insuredName: string; phoneNo: string; vehicleClass: string; make: string; model: string; fuelType: string;
  capacity: string; manufacturingYear: string; chassisNo: string; engineNo: string; rtoState: string; rtoName: string;
  policyProduct: string; idv: string; od: string; tp: string; cpaOpted: 'Yes' | 'No'; cpa: string;
  policyNo: string; insurerId: string; validFrom: string; validUpto: string;
  payoutBasis: string; projectedOdPercent: string; projectedTpPercent: string; insurerScheme: string; payinBillNo: string; payinBilledAmount: string; payinBillDate: string; payinStatus: string; retention: string; payoutOdPercent: string; payoutTpPercent: string; flatPayoutAmount: string; payoutStatus: string; payoutDate: string; payoutVoucherNo: string; remarks: string;
};
export type NativeOnboardingData = { draft: NativePolicyDraft; revision: number; intake_number: string; insurers: {value:string;label:string}[]; manufacturers: string[] };
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
