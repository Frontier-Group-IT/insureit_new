import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { AadhaarMaskNormalizer } from "@/components/aadhaar-mask-normalizer";
import { EmbeddedMasterSaveBridge } from "@/components/embedded-master-save-bridge";
import { LegacyIntermediaryImportLink } from "@/components/legacy-intermediary-import-link";
import { RouteProgressBar } from "@/components/loading/route-progress-bar";
import { PolicyEditCopyFooterActions } from "@/components/policy-edit-copy-footer-actions";
import { PolicySaveConfirmation } from "@/components/policy-save-confirmation";
import { SuccessPopup } from "@/components/success-popup";
import { ProfessionalFormValidation } from "@/components/professional-form-validation";
import "./globals.css";
import "./experience.css";
import "./mobile.css";
import "./document-grid.css";
import "./reconciliation-workbench.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "InsureIt Operations",
  description: "Commercial vehicle insurance operations, reimagined.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${spaceGrotesk.variable}`}>
      <body>
        <AppRouterCacheProvider>
          {children}
          <Suspense fallback={null}>
            <AadhaarMaskNormalizer />
            <EmbeddedMasterSaveBridge />
            <LegacyIntermediaryImportLink />
            <ProfessionalFormValidation />
            <PolicyEditCopyFooterActions />
            <PolicySaveConfirmation />
            <SuccessPopup />
            <RouteProgressBar />
          </Suspense>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
