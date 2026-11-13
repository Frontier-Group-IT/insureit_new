/**
 * Pure, fail-closed authorization for the Daily Report actor filter.
 * The report loader must apply this list inside every database query,
 * not after retrieving unrestricted activity rows.
 */
export type DailyReportViewerScope = "self" | "all";
export type DailyReportEmployeeScope = {
  mode: "organization" | "hierarchy" | "self" | "none";
  profileIds: string[];
};
export function resolveDailyReportActorIds(
  viewerId: string,
  tab: DailyReportViewerScope,
  access: DailyReportEmployeeScope,
): string[] | null {
  if (!viewerId) return [];
  if (tab === "self") return [viewerId];
  if (access.mode === "organization") return null;
  if (access.mode === "none") return [viewerId];
  // Never grant other profiles when the employee scope is only Self.
  if (access.mode === "self") return [viewerId];
  return Array.from(new Set([viewerId, ...access.profileIds.filter(Boolean)]));
}
