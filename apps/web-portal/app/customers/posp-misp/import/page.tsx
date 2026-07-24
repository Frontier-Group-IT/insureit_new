import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { uploadPospMispWorkbook } from "../actions";
import { ImportWorkbookForm } from "./import-workbook-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospMispImportPage() {
  await requirePospMispManager();
  return (
    <AppShell title="Import POSP / MISP">
      <ImportWorkbookForm action={uploadPospMispWorkbook} />
    </AppShell>
  );
}
