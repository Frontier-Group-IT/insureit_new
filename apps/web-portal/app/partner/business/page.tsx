import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
const allowed = new Set(["period","from","to","business","insurer","rm","intermediary","mix"]);
/** Legacy bookmarked route: all business reporting now lives inside Reports. */
export default async function LegacyPartnerBusinessRedirect({ searchParams }: { searchParams: Promise<Record<string,string | string[] | undefined>> }) {
  const query = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (allowed.has(key) && typeof value === "string" && value.length <= 100) params.set(key, value);
  }
  redirect(`/partner/reports/business${params.size ? `?${params.toString()}` : ""}`);
}
