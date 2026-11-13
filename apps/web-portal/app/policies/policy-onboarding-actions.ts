"use server";

import { requirePolicyCreator } from "@/lib/policy-access-server";
import {
  onboardPolicyForVerifiedActor,
  loadExistingVehicleForPolicyOnboarding as loadExistingVehicleForPolicyOnboardingServer,
} from "@/lib/policy-onboarding-engine";
import type { PolicyOnboardingPayload } from "@/lib/policy-onboarding-engine";

export type {
  PolicyCustomerCandidate, PolicyOwnershipConflict, PolicyExistingVehicleSelection,
  PolicyOnboardingPayload, PolicyOnboardingResult,
} from "@/lib/policy-onboarding-engine";

export async function loadExistingVehicleForPolicyOnboarding(vehicleId: string) {
  return loadExistingVehicleForPolicyOnboardingServer(vehicleId);
}

export async function onboardPolicy(payload: PolicyOnboardingPayload) {
  const profile = await requirePolicyCreator(String(payload.policy.intermediaryCode ?? ""));
  return onboardPolicyForVerifiedActor(payload, profile);
}
