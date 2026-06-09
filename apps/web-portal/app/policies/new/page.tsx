import { PolicyForm } from "@/components/forms";
import { AppShell, PageHeader } from "@/components/shell";

export default function NewPolicyPage() {
  return <AppShell><PageHeader title="Add policy" description="Attach an insurance policy to a customer and commercial vehicle." /><PolicyForm /></AppShell>;
}
