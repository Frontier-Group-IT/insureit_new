/**
 * Keep RM/customer scope checks on the server while avoiding oversized PostgREST
 * URLs. Each ID chunk is paged independently (PostgREST defaults to 1,000 rows).
 * Never return a partial total if any page fails.
 */
export const dashboardScopeBatchSize = 100;
export const dashboardScopePageSize = 500;

export async function loadScopedDashboardRows<T>(
  ids: readonly string[],
  loadPage: (ids: string[], from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<{ data: T[] | null; error: Error | null }> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += dashboardScopeBatchSize) {
    const batch = ids.slice(i, i + dashboardScopeBatchSize);
    for (let from = 0; ; from += dashboardScopePageSize) {
      const response = await loadPage(batch, from, from + dashboardScopePageSize - 1);
      if (response.error) return { data: null, error: new Error(response.error.message) };
      const page = response.data ?? [];
      rows.push(...page);
      if (page.length < dashboardScopePageSize) break;
    }
  }
  return { data: rows, error: null };
}
