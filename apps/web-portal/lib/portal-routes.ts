export const protectedPortalRoots = [
  "/dashboard",
  "/customers",
  "/vehicles",
  "/policies",
  "/claims",
  "/documents",
  "/timeline",
  "/tasks",
  "/reports",
  "/organization",
  "/users",
  "/notifications",
  "/settings",
  "/claim-documents"
] as const;

export function isProtectedPortalPath(pathname: string) {
  return protectedPortalRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function safePortalReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value) || /%2f|%5c/i.test(value)) return "/dashboard";

  try {
    const url = new URL(value, "https://portal.insureit.local");
    if (url.origin !== "https://portal.insureit.local" || !isProtectedPortalPath(url.pathname)) return "/dashboard";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}

export function claimPath(claimId: string) {
  return `/claims/${encodeURIComponent(claimId)}`;
}

export function customerEditPath(customerId: string) {
  return `/customers/${encodeURIComponent(customerId)}/edit`;
}
