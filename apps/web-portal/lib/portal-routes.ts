import { internalLaunchHome } from "@/lib/launch-scope";

export const protectedPortalRoots = [
  "/dashboard",
  "/intermediaries",
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
  "/claim-documents",
  "/intermediary-portal"
] as const;

export function isProtectedPortalPath(pathname: string) {
  return protectedPortalRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function safePortalReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return internalLaunchHome;
  if (value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value) || /%2f|%5c/i.test(value)) return internalLaunchHome;

  try {
    const url = new URL(value, "https://portal.insureit.local");
    if (url.origin !== "https://portal.insureit.local" || !isProtectedPortalPath(url.pathname)) return internalLaunchHome;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return internalLaunchHome;
  }
}

export function claimPath(claimId: string) {
  return `/claims/${encodeURIComponent(claimId)}`;
}

export function customerEditPath(customerId: string) {
  return `/customers/${encodeURIComponent(customerId)}/edit`;
}
