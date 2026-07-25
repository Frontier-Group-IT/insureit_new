import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingSettings() {
  return <AppShell title="Settings"><PageSkeleton variant="list" /></AppShell>;
}
