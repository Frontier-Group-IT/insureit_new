import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InsureIT Developer Workspace",
  description: "Private engineering control plane for the InsureIT ecosystem.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
