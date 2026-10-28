import { createClient } from "@/lib/supabase";

export async function openPartnerPolicyIntakeDocumentWeb(id: string) {
  const supabase = createClient();
  const { data: session } = await supabase.auth.getSession();
  let token = session.session?.access_token;
  const request = (accessToken?: string) => fetch(`/api/partner/policy-intakes/${encodeURIComponent(id)}/document`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  let response = await request(token);
  if (response.status === 401) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (!error && refreshed.session?.access_token && refreshed.session.access_token !== token) {
      token = refreshed.session.access_token;
      response = await request(token);
    }
  }
  const payload = await response.json().catch(() => null) as { ok?: boolean; url?: string; error?: string } | null;
  if (!response.ok || !payload?.ok || !payload.url) {
    throw new Error(payload?.error || "Could not open the policy copy.");
  }
  return payload.url;
}
