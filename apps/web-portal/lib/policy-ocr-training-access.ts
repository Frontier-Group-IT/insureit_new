import "server-only";

import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";

export async function requirePolicyOcrTrainingOperator() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || profile.role !== "it_super_user") redirect("/access-denied");

  const [canReview, canApprove] = await Promise.all([
    hasEffectiveCapability(profile, "review_policy_ocr_training", "edit"),
    hasEffectiveCapability(profile, "approve_policy_ocr_training", "approve"),
  ]);
  if (!canReview && !canApprove) redirect("/access-denied");

  return profile;
}
