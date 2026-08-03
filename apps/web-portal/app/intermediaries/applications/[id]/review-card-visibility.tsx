"use client";

import { usePathname } from "next/navigation";

export function ReviewCardVisibility({ applicationId, children }: { applicationId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname !== `/intermediaries/applications/${applicationId}`) return null;
  return <>{children}</>;
}
