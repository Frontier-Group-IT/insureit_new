/**
 * Daily Report paging bounds. Requests are intentionally bounded on the
 * server, but must cover current real-world busy days (more than 450 events).
 */
export const DAILY_PAGE_SIZE = 30;
export const DAILY_MAX_PAGE = 40;
export const DAILY_SOURCE_CAP = 1260;

export function dailyPageWindow(value: string | undefined) {
  const parsed = Number(value);
  const valid = typeof value === "string" && /^[1-9]\d{0,3}$/.test(value) &&
    Number.isSafeInteger(parsed);
  const page = valid ? Math.min(DAILY_MAX_PAGE, parsed) : 1;
  const start = (page - 1) * DAILY_PAGE_SIZE;
  const sourceLimit = Math.min(DAILY_SOURCE_CAP, (page + 1) * DAILY_PAGE_SIZE);
  return { page, start, sourceLimit };
}

export function dailyHasMore(totalFetched: number, start: number, page: number) {
  const hasMore = totalFetched > start + DAILY_PAGE_SIZE;
  return { hasNext: hasMore && page < DAILY_MAX_PAGE, truncated: hasMore && page >= DAILY_MAX_PAGE };
}
