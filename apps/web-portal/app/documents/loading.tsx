import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingDocuments() {
  return <AppShell title="Documents"><PageSkeleton variant="list" /></AppShell>;
}
