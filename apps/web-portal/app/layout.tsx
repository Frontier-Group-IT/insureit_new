import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { RouteProgressBar } from "@/components/loading/route-progress-bar";
import { SuccessPopup } from "@/components/success-popup";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "InsureIt Admin Portal",
  description: "Manage commercial vehicle insurance claim assistance operations with InsureIt"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <SuccessPopup />
        <RouteProgressBar />
      </body>
    </html>
  );
}
