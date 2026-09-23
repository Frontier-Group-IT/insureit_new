import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AadhaarMaskNormalizer } from "@/components/aadhaar-mask-normalizer";
import { ClaimRealtimeRefresh } from "@/components/claim-realtime-refresh";
import { ClientRuntimeErrorMonitor } from "@/components/client-runtime-error-monitor";
import { GlobalDropdownDismiss } from "@/components/global-dropdown-dismiss";
import { RouteProgressBar } from "@/components/loading/route-progress-bar";
import { PolicyRouteEnhancements } from "@/components/policy-route-enhancements";
import { PortalRouteEnhancements } from "@/components/portal-route-enhancements";
import { ProfessionalFormValidation } from "@/components/professional-form-validation";
import "./globals.css";
import "./experience.css";
import "./mobile.css";
import "./document-grid.css";
import "./accounts-navigation-labels.css";
import "./policy-summary-stability.css";
import "./policy-section-nav.css";

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
            <ClientRuntimeErrorMonitor />
            <GlobalDropdownDismiss />
            <AadhaarMaskNormalizer />
            <ClaimRealtimeRefresh />
            <PortalRouteEnhancements />
            <ProfessionalFormValidation />
            <PolicyRouteEnhancements />
            <RouteProgressBar />
          </Suspense>
          <SpeedInsights />
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
