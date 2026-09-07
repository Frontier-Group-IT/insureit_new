import "server-only";

import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

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

export async function requirePolicyOcrTrainingViewer() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || profile.is_active === false) redirect("/access-denied");

  const isOperator = profile.role === "it_super_user" && (await Promise.all([
    hasEffectiveCapability(profile, "review_policy_ocr_training", "edit"),
    hasEffectiveCapability(profile, "approve_policy_ocr_training", "approve"),
  ])).some(Boolean);
  if (isOperator) return { profile, isOperator: true as const };

  const admin = createSupabaseAdminClient();
  const { data: assignedTask, error } = await admin
    .from("policy_ocr_training_review_tasks")
    .select("id")
    .eq("assigned_reviewer_profile_id", profile.id)
    .neq("status", "cancelled")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error || !assignedTask) redirect("/access-denied");

  return { profile, isOperator: false as const };
}
