"use server";

import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { isEmployeeWithinAccessScope } from "@/lib/employee-access-scope";
import type { PospMispState } from "./actions";
import { createManualPospMispOnboardingV2 } from "./manual-actions-v2";

export async function createScopedManualPospMispOnboarding(state: PospMispState, data: FormData): Promise<PospMispState> {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const employeeId = text(data, "associate_employee_id");
  if (!profile?.id || !employeeId) return { error: "Select a valid RM Name.", field: "associate_employee_id" };
  const allowed = await isEmployeeWithinAccessScope(profile.id, profile.role, employeeId);
  if (!allowed) return { error: "You can only create an application for yourself or an employee in your reporting hierarchy.", field: "associate_employee_id" };
  return createManualPospMispOnboardingV2(state, data);
}

function text(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
