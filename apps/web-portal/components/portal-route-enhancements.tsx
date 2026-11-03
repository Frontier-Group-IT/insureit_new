"use client";

import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";

const EmbeddedMasterSaveBridge = dynamic(
  () => import("@/components/embedded-master-save-bridge").then((module) => module.EmbeddedMasterSaveBridge),
  { ssr: false },
);
const LegacyIntermediaryImportLink = dynamic(
  () => import("@/components/legacy-intermediary-import-link").then((module) => module.LegacyIntermediaryImportLink),
  { ssr: false },
);
const SuccessPopup = dynamic(
  () => import("@/components/success-popup").then((module) => module.SuccessPopup),
  { ssr: false },
);

const LEGACY_IMPORT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_LEGACY_INTERMEDIARY_IMPORT === "true";

export function PortalRouteEnhancements() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const embeddedMasterRoute =
    pathname === "/vehicles"
    || pathname === "/customers"
    || /^\/customers\/[^/]+\/edit$/.test(pathname);
  const legacyImportRoute =
    LEGACY_IMPORT_ENABLED
    && /^\/intermediaries\/applications\/[^/]+\/?$/.test(pathname);
  // Associate Accounts handles errors with its own actionable acknowledgement dialog.
  // Avoid stacking the generic raw error popup over that dialog.
  const hasPageSpecificAssociateError = /^\/intermediaries\/applications\/[^/]+\/associate-accounts\/?$/.test(pathname)
    && (searchParams.has("error") || searchParams.has("associate_error"));
  // Branch management routes display their own contextual error notice.
  // Do not show an additional global popup containing the same raw error.
  const hasPageSpecificBranchError = searchParams.has("error") && (
    pathname === "/intermediaries/groups/branches/new"
    || pathname === "/intermediaries/groups/login-access"
    || pathname === "/intermediaries/groups"
  );
  const hasPopupMessage = (searchParams.has("success") || searchParams.has("error"))
    && !hasPageSpecificAssociateError && !hasPageSpecificBranchError;

  return (
    <>
      {embeddedMasterRoute ? <EmbeddedMasterSaveBridge /> : null}
      {legacyImportRoute ? <LegacyIntermediaryImportLink /> : null}
      {hasPopupMessage ? <SuccessPopup /> : null}
    </>
  );
}
