import { AppShell } from "@/components/shell";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { NonTataParserTestPanel } from "./non-tata-parser-test-panel";

export default async function NonTataParserTestPage() {
  await requirePolicyOcrTrainingOperator();
  return <AppShell title="Non-Tata Policy Parser Test"><NonTataParserTestPanel /></AppShell>;
}
