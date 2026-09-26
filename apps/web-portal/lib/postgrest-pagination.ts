import "server-only";

type PageResult<T, E> = {
  data: T[] | null;
  error: E | null;
};

const DEFAULT_PAGE_SIZE = 1000;

/**
 * Fetches every row from a PostgREST query in explicit ranges so the
 * project-level max-rows setting cannot silently truncate register data.
 * The caller supplies a fresh query for each page so existing filters,
 * joins and ordering are preserved exactly.
 */
export async function fetchAllPostgrestRows<T, E = unknown>(
  loadPage: (from: number, to: number) => PromiseLike<PageResult<T, E>>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<PageResult<T, E>> {
  const rows: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const result = await loadPage(from, from + pageSize - 1);
    if (result.error) return { data: null, error: result.error };

    const page = result.data ?? [];
    rows.push(...page);

    if (page.length < pageSize) return { data: rows, error: null };
  }
}
