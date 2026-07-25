import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingTasks() {
  return <AppShell title="Follow-up tasks"><PageSkeleton variant="list" /></AppShell>;
}
