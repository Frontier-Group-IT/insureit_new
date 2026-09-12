import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { accessTokenCookie } from "@/lib/auth-config";
import { getAuthenticatedProfile } from "@/lib/auth";
import AuthbridgeRcEnrichmentClient from "./authbridge-rc-enrichment-client";

export const dynamic = "force-dynamic";

export default async function AuthbridgeRcEnrichmentPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(accessTokenCookie)?.value;
  const auth = await getAuthenticatedProfile(accessToken);

  if (!auth.user || !auth.profile?.is_active) redirect("/login?next=/reports/authbridge-rc-enrichment");
  if (auth.profile.role !== "super_admin") redirect("/access-denied");

  return <AuthbridgeRcEnrichmentClient />;
}
