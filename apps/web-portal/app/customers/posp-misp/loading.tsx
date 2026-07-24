import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingPospMispList() {
  return <AppShell title="POSP / MISP Onboarding"><PageSkeleton variant="list" /></AppShell>;
}
