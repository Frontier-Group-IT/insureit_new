import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingPospMispForm() {
  return <AppShell title="New POSP / MISP Application"><PageSkeleton variant="file" /></AppShell>;
}
