"use server";

import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { isEmployeeWithinAccessScope } from "@/lib/employee-access-scope";
import type { PospMispState } from "./actions";
import { createManualPospMispOnboardingV2 } from "./manual-actions-v2";

type ScopedResult = PospMispState & { applicationId?: string | null };

export async function createScopedManualPospMispOnboarding(state: PospMispState, data: FormData): Promise<ScopedResult> {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const employeeId = text(data, "associate_employee_id");
  if (!profile?.id || !employeeId) return { error: "Select a valid RM Name.", field: "associate_employee_id" };
  const allowed = await isEmployeeWithinAccessScope(profile.id, profile.role, employeeId);
  if (!allowed) return { error: "You can only create an application for yourself or an employee in your reporting hierarchy.", field: "associate_employee_id" };
  return createManualPospMispOnboardingV2(state, data);
}

export async function submitScopedManualPospMispOnboarding(data: FormData): Promise<void> {
  const partnerType = text(data, "partner_type") === "misp" ? "misp" : "posp";
  const result = await createScopedManualPospMispOnboarding({ error: null, field: null }, data);
  if (result.error) {
    const params = new URLSearchParams({ partner_type: partnerType, error: result.error });
    if (result.field) params.set("field", result.field);
    redirect(`/customers/posp-misp/new?${params.toString()}`);
  }
  if (!result.applicationId) {
    const params = new URLSearchParams({ partner_type: partnerType, error: "The application was saved but its reference could not be returned. Open Onboarding Applications to continue." });
    redirect(`/customers/posp-misp/new?${params.toString()}`);
  }
  redirect(`/intermediaries/applications/${result.applicationId}?success=posp_misp_submitted`);
}

function text(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
