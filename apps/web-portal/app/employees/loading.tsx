import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingEmployees() {
  return (
    <AppShell title="Employees">
      <PageSkeleton variant="list" />
    </AppShell>
  );
}
