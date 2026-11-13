"use server";

import { requirePolicyCreator, requirePolicyEditor } from "@/lib/policy-access-server";
import { requestPolicyDateApprovalForVerifiedActor, verifyPolicyDateApprovalForVerifiedActor } from "@/lib/policy-date-approval-engine";

type ApprovalInput = {
  issuanceDate:string; policyNumber:string; approverKey:string;
  operation:"create"|"edit"; existingPolicyId?:string|null; intermediaryCode?:string;
};

async function profileFor(input:Pick<ApprovalInput,"operation"|"existingPolicyId"|"intermediaryCode">){
  if(input.operation==="edit"){
    if(!input.existingPolicyId||!/^[0-9a-f-]{36}$/i.test(input.existingPolicyId))return null;
    return requirePolicyEditor(input.existingPolicyId);
  }
  return requirePolicyCreator(input.intermediaryCode);
}

export async function requestPolicyDateApproval(input:ApprovalInput){
  const profile=await profileFor(input);
  if(!profile)return {ok:false as const,error:"Choose a valid policy before requesting approval."};
  return requestPolicyDateApprovalForVerifiedActor(input,profile);
}
export async function verifyPolicyDateApproval(approvalId:string,otp:string,input:Omit<ApprovalInput,"approverKey">){
  const profile=await profileFor(input);
  if(!profile)return {ok:false as const,error:"This policy cannot be approved from your account."};
  return verifyPolicyDateApprovalForVerifiedActor(approvalId,otp,input,profile);
}
