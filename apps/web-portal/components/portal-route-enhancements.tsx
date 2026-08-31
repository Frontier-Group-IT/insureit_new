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
  const hasPopupMessage = searchParams.has("success") || searchParams.has("error");

  return (
    <>
      {embeddedMasterRoute ? <EmbeddedMasterSaveBridge /> : null}
      {legacyImportRoute ? <LegacyIntermediaryImportLink /> : null}
      {hasPopupMessage ? <SuccessPopup /> : null}
    </>
  );
}
