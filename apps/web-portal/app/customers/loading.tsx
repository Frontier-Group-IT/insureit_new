import { AppShell } from "@/components/shell";
import { PageSkeleton } from "@/components/loading/page-skeleton";

export default function LoadingCustomers() {
  return <AppShell title="Customers"><PageSkeleton variant="list" /></AppShell>;
}
