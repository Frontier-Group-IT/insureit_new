import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { RouteProgressBar } from "@/components/loading/route-progress-bar";
import { SuccessPopup } from "@/components/success-popup";
import "./globals.css";
import "./experience.css";

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
        <SuccessPopup />
        <RouteProgressBar />
      </body>
    </html>
  );
}
