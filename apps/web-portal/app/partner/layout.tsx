import type { ReactNode } from "react";
import { PartnerNavigation } from "@/components/partner-portal/partner-navigation";
import { getPartnerWebSession } from "@/lib/partner-web";

export default async function PartnerLayout({ children }: { children: ReactNode }) {
  const { scope } = await getPartnerWebSession();
  const hideAccount = scope.scope_mode === "hierarchy";

  return (
    <>
      <style>{`
        svg[aria-label^="Premium and policy trend"] polyline {
          opacity: 0.35;
          stroke-width: 1.5;
        }

        svg[aria-label^="Premium and policy trend"] circle[fill="#163968"] {
          opacity: 0.35;
        }
      `}</style>
      <PartnerNavigation hideAccount={hideAccount} />
      {children}
    </>
  );
}
