import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getPartnerWebSession } from "@/lib/partner-web";

export default async function PartnerAccountLayout({ children }: { children: ReactNode }) {
  const { scope } = await getPartnerWebSession();

  if (scope.scope_mode === "hierarchy") {
    redirect("/partner");
  }

  return children;
}
