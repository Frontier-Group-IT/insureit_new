"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const PolicyEditCopyFooterActions = dynamic(
  () => import("@/components/policy-edit-copy-footer-actions").then((module) => module.PolicyEditCopyFooterActions),
  { ssr: false },
);
const PolicySaveConfirmation = dynamic(
  () => import("@/components/policy-save-confirmation").then((module) => module.PolicySaveConfirmation),
  { ssr: false },
);

const policyEditRoutePattern = /^\/policies\/[0-9a-f-]{36}\/edit\/?$/i;

export function PolicyRouteEnhancements() {
  const pathname = usePathname();
  if (!pathname.startsWith("/policies")) return null;

  return (
    <>
      {policyEditRoutePattern.test(pathname) ? <PolicyEditCopyFooterActions /> : null}
      <PolicySaveConfirmation />
    </>
  );
}
