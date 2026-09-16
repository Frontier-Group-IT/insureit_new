import { internalLaunchHome } from "@/lib/launch-scope";

export const protectedPortalRoots = [
  "/accounts",
  "/claim-documents",
  "/claims",
  "/customer-kyc",
  "/customers",
  "/dashboard",
  "/dashboard-v2",
  "/development",
  "/documents",
  "/employees",
  "/insurance-companies",
  "/intermediaries",
  "/intermediary-portal",
  "/master-data",
  "/notifications",
  "/organization",
  "/partner",
  "/policies",
  "/policy-intakes",
  "/reconciliation",
  "/reports",
  "/service-enquiries",
  "/settings",
  "/system",
  "/tasks",
  "/timeline",
  "/users",
  "/vehicles"
] as const;

export const accountsRolePortalRoots = [
  "/accounts",
  "/reconciliation",
  "/policies/commercial-review",
  "/reports/accounts",
  "/reports/export/accounts",
] as const;

export function isProtectedPortalPath(pathname: string) {
  return protectedPortalRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export function isAccountsRolePortalPath(pathname: string) {
  return accountsRolePortalRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
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
