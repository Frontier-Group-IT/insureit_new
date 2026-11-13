"use server";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { lookupPolicyRegistrationRcForVerifiedActor } from "@/lib/policy-rc-lookup-engine";
export type { PolicyRcReview, PolicyRcLookupResult } from "@/lib/policy-rc-lookup-engine";
export async function lookupPolicyRegistrationRc(registrationNumber:string){
  await requirePolicyCreator();
  return lookupPolicyRegistrationRcForVerifiedActor(registrationNumber);
}
