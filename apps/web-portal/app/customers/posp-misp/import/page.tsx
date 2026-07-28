import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { uploadPospMispWorkbookV2 } from "./bulk-upload-v2-actions";
import { ImportWorkbookForm } from "./import-workbook-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospMispImportPage() {
  await requirePospMispManager();
  return (
    <AppShell title="Import POSP / MISP">
      <div className="mx-auto max-w-[1180px] space-y-3">
        <div className="flex justify-end"><Link href="/customers/posp-misp/import/batches" className="rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-2.5 text-[10.5px] font-semibold text-[#4338CA]">View Previous Imports</Link></div>
        <ImportWorkbookForm action={uploadPospMispWorkbookV2} />
      </div>
    </AppShell>
  );
}
