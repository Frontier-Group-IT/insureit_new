import type { ReactNode } from "react";
import { PartnerNavigation } from "@/components/partner-portal/partner-navigation";

export default function PartnerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PartnerNavigation />
      {children}
    </>
  );
}
