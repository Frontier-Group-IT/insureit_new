import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LegacyAuthbridgeRcEnrichmentPage() {
  redirect("/development/authbridge-rc-enrichment");
}
