import { PolicyForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";

export default function EditPolicyPage() {
  return <AppShell><PageHeader title="Edit policy" description="Update policy details, coverage period, insurer, and IDV." /><PolicyForm /></AppShell>;
}
