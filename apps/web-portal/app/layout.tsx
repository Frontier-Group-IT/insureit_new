import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AadhaarMaskNormalizer } from "@/components/aadhaar-mask-normalizer";
import { FreshDynamicRouteNavigation } from "@/components/fresh-dynamic-route-navigation";
import { PartnerLinkedAccountHeaderNormalizer } from "@/components/partner-linked-account-header-normalizer";
import { PospMispReviewCleanup } from "@/components/posp-misp-review-cleanup";
import { RouteProgressBar } from "@/components/loading/route-progress-bar";
import { SuccessPopup } from "@/components/success-popup";
import { ProfessionalFormValidation } from "@/components/professional-form-validation";
import "./globals.css";
import "./experience.css";
import "./mobile.css";
import "./unified-stepper.css";

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
        {children}
        <Suspense fallback={null}>
          <AadhaarMaskNormalizer />
          <PospMispReviewCleanup />
          <PartnerLinkedAccountHeaderNormalizer />
          <ProfessionalFormValidation />
          <SuccessPopup />
          <FreshDynamicRouteNavigation />
          <RouteProgressBar />
        </Suspense>
      </body>
    </html>
  );
}
