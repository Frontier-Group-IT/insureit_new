export async function openPartnerPolicyIntakeDocumentWeb(id: string) {
  const response = await fetch(`/api/partner/policy-intakes/${encodeURIComponent(id)}/document`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as { ok?: boolean; url?: string; error?: string } | null;
  if (!response.ok || !payload?.ok || !payload.url) {
    throw new Error(payload?.error || "Could not open the policy copy.");
  }
  return payload.url;
}
