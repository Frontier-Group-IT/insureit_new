const configuredScope = process.env.NEXT_PUBLIC_INSUREIT_LAUNCH_SCOPE?.trim().toLowerCase();

export const isIntermediaryOnlyLaunch = configuredScope === "intermediary";
export const internalLaunchHome = isIntermediaryOnlyLaunch ? "/intermediaries" : "/dashboard";

export function isIntermediaryLaunchPath(pathname: string) {
  if (pathname === "/intermediaries" || pathname.startsWith("/intermediaries/")) return true;
  if (pathname === "/intermediary-portal" || pathname.startsWith("/intermediary-portal/")) return true;
  if (pathname === "/customers/posp-misp" || pathname.startsWith("/customers/posp-misp/")) {
    return pathname !== "/customers/posp-misp/icall-uat" && !pathname.startsWith("/customers/posp-misp/icall-uat/");
  }
  return false;
}
