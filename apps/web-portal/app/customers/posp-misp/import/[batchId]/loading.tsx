import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingImportReview() {
  return <AppShell title="Review POSP / MISP Import"><PageSkeleton variant="import" /></AppShell>;
}
