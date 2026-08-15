import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { AadhaarMaskNormalizer } from "@/components/aadhaar-mask-normalizer";
import { LegacyIntermediaryImportLink } from "@/components/legacy-intermediary-import-link";
import { RouteProgressBar } from "@/components/loading/route-progress-bar";
import { SuccessPopup } from "@/components/success-popup";
import { ProfessionalFormValidation } from "@/components/professional-form-validation";
import "./globals.css";
import "./experience.css";
import "./mobile.css";
import "./document-grid.css";

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
            <LegacyIntermediaryImportLink />
            <ProfessionalFormValidation />
            <SuccessPopup />
            <RouteProgressBar />
          </Suspense>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
