import { isValidDailyRecordId } from "@/lib/reports/daily-history-validation";

/** Only canonical record types can be opened; audit strings are never URL paths. */
export const DAILY_ACTIVITY_RECORD_ROUTES: Readonly<Record<string,string>> = {
  policies: "/policies",
  policy_intake_requests: "/policy-intakes",
  life_health_cases: "/policies/life-health-cases",
  customers: "/customers",
  vehicles: "/vehicles",
  claims: "/claims",
};

export function dailyActivityRecordHref(table?:string, recordId?:string):string|null {
  if (!table || !recordId || !isValidDailyRecordId(recordId)) return null;
  const base=DAILY_ACTIVITY_RECORD_ROUTES[table];
  // Vehicle Register opens the original capability-gated View/Edit screen.
  // /vehicles/[id] is a separate read-only detail page; do not send report rows there.
  if (table === "vehicles") return `${base}/${recordId}/edit`;
  return base ? `${base}/${recordId}` : null;
}
