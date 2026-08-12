export type AssistantLink = { label: string; href: string };
export type AssistantReply = { text: string; links: AssistantLink[] };

export function isSafeAssistantHref(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return false;
  try {
    if (decodeURIComponent(value).includes("\\")) return false;
    const parsed = new URL(value, "https://insureit.invalid");
    return parsed.origin === "https://insureit.invalid" && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function limitAssistantReplyLinks(reply: AssistantReply, allowedHrefs: ReadonlySet<string>): AssistantReply {
  return { ...reply, links: reply.links.filter((link) => allowedHrefs.has(link.href)) };
}

export function normalizeAssistantReply(value: unknown): AssistantReply | null {
  const record = objectValue(value);
  if (!record) return null;
  const rawText = typeof record.answer === "string" ? record.answer : typeof record.message === "string" ? record.message : "";
  const text = rawText.trim().slice(0, 12_000);
  if (!text) return null;
  const rawLinks = Array.isArray(record.links) ? record.links : Array.isArray(record.navigation) ? record.navigation : [];
  const links: AssistantLink[] = [];
  for (const candidate of rawLinks) {
    const link = objectValue(candidate);
    if (!link || typeof link.label !== "string" || !isSafeAssistantHref(link.href)) continue;
    const label = link.label.trim().slice(0, 120);
    if (!label || links.some((entry) => entry.href === link.href && entry.label === label)) continue;
    links.push({ label, href: link.href });
    if (links.length === 6) break;
  }
  return { text, links };
}
