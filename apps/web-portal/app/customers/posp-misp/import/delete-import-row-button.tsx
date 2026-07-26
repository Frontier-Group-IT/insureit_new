"use client";

import { useCallback, useState, useTransition } from "react";
import { ConfirmationDialog } from "@/components/confirmation-dialog";
import { deletePospMispImportRow } from "../actions";

export function DeleteImportRowButton({ batchId, rowId, rowNumber }: { batchId: string; rowId: string; rowNumber: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const close = useCallback(() => { if (!pending) setOpen(false); }, [pending]);

  function remove() {
    startTransition(async () => {
      const data = new FormData();
      data.set("batch_id", batchId);
      data.set("row_id", rowId);
      await deletePospMispImportRow(data);
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Remove row" aria-label={`Remove row ${rowNumber}`} disabled={pending} className="grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:cursor-wait disabled:opacity-60"><TrashIcon /></button>
      <ConfirmationDialog open={open} title="Remove import row" message={`Row ${rowNumber} will be removed from this import batch. This action cannot be undone.`} confirmLabel="Remove row" busyLabel="Removing…" tone="danger" busy={pending} onCancel={close} onConfirm={remove} />
    </>
  );
}

function TrashIcon(){return <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>}
