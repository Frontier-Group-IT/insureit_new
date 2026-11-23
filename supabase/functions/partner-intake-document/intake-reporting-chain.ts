/**
 * Pure, read-only reporting-chain resolver for the staged Partner PDF endpoint.
 * Mirrors reportingChainScope() from the Operations Policy Intake scope:
 * walk only active employee relationships, retain the caller, and map
 * descendants to active profiles. This is NOT the complete RM Policy Intake
 * scope: assigned Partner/Branch source and override rules are separate.
 */
export type EmployeeLink = { id: string; reporting_manager_id: string | null };
export type ProfileLink = { id: string; employee_id: string | null };

export function resolveActiveReportingProfiles(
  ownerEmployeeId: string,
  ownerProfileId: string,
  employees: readonly EmployeeLink[],
  profiles: readonly ProfileLink[],
): { employeeIds: string[]; profileIds: string[] } {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(ownerEmployeeId) || !uuid.test(ownerProfileId))
    throw new Error("Invalid reporting-chain owner");
  const children = new Map<string, string[]>();
  for (const item of employees) {
    if (!uuid.test(item.id) || (item.reporting_manager_id && !uuid.test(item.reporting_manager_id)))
      throw new Error("Invalid reporting-chain employee");
    if (!item.reporting_manager_id) continue;
    const siblings = children.get(item.reporting_manager_id) ?? [];
    siblings.push(item.id);
    children.set(item.reporting_manager_id, siblings);
  }
  // The owner must itself be active. A terminated/missing owner must not
  // allow traversing stale descendant links.
  if (!employees.some(item => item.id === ownerEmployeeId))
    throw new Error("Reporting-chain owner is not active");
  const seen = new Set<string>();
  const queue = [ownerEmployeeId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  const employeeIds = [...seen];
  const profileIds = new Set([ownerProfileId]);
  for (const profile of profiles) {
    if (!uuid.test(profile.id) || (profile.employee_id && !uuid.test(profile.employee_id)))
      throw new Error("Invalid reporting-chain profile");
    if (profile.employee_id && seen.has(profile.employee_id)) profileIds.add(profile.id);
  }
  return { employeeIds, profileIds: [...profileIds] };
}
