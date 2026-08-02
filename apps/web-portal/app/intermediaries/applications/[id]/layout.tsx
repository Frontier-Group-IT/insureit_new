import type { ReactNode } from "react";
import { requireScopedPospMispManager } from "@/lib/master-data-server";

export default async function ApplicationReviewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireScopedPospMispManager(id);
  return children;
}
