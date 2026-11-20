import { AppShell } from "@/components/shell";
import { requirePolicyEditor } from "@/lib/policy-access-server";
import { NonTataParserTestPanel } from "./non-tata-parser-test-panel";

export default async function NonTataParserTestPage() {
  await requirePolicyEditor();
  return <AppShell title="Non-Tata Policy Parser Test"><NonTataParserTestPanel /></AppShell>;
}
