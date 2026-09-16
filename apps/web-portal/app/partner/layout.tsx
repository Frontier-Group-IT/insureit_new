import type { ReactNode } from "react";
import { PartnerNavigation } from "@/components/partner-portal/partner-navigation";
import { getPartnerWebSession } from "@/lib/partner-web";

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const { scope } = await getPartnerWebSession();
  const hideAccount = scope.scope_mode === "hierarchy";

  return (
    <>
      <PartnerNavigation hideAccount={hideAccount} />
      {children}
    </>
  );
}
