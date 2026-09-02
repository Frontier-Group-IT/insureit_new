import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AadhaarMaskNormalizer } from "@/components/aadhaar-mask-normalizer";
import { RouteProgressBar } from "@/components/loading/route-progress-bar";
import { PolicyRouteEnhancements } from "@/components/policy-route-enhancements";
import { PortalRouteEnhancements } from "@/components/portal-route-enhancements";
import { ProfessionalFormValidation } from "@/components/professional-form-validation";
import "./globals.css";
import "./experience.css";
import "./mobile.css";
import "./document-grid.css";
import "./accounts-navigation-labels.css";

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
            <PortalRouteEnhancements />
            <ProfessionalFormValidation />
            <PolicyRouteEnhancements />
            <RouteProgressBar />
          </Suspense>
          <Analytics />
          <SpeedInsights />
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
