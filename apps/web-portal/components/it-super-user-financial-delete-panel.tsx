"use client";

import { AlertTriangle, Search, ShieldAlert, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteFinancialRecord,
  previewFinancialDelete,
  type DeletableFinancialEntity,
  type FinancialDeletePreview,
} from "@/app/financial-record-delete-actions";

export type FinancialDeleteOption = {
  id: string;
  label: string;
  detail?: string | null;
};

type Props = {
  entity: DeletableFinancialEntity;
  title: string;
  records: FinancialDeleteOption[];
};

const entityLabel: Record<DeletableFinancialEntity, string> = {
  reconciliation_cycle: "reconciliation cycle",
  accounts_invoice: "draft invoice",
};

export function ItSuperUserFinancialDeletePanel({ entity, title, records }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState<Extract<FinancialDeletePreview, { ok: true }> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records.slice(0, 100);
    return records.filter((record) => `${record.label} ${record.detail ?? ""}`.toLowerCase().includes(normalized)).slice(0, 100);
  }, [query, records]);

  const selected = records.find((record) => record.id === selectedId) ?? null;

  function beginDelete() {
    if (!selected || isPending) return;
    setMessage(null);
    setPreview(null);
    startTransition(async () => {
      const result = await previewFinancialDelete(entity, selected.id);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setPreview(result);
      setConfirming(true);
    });
  }

  function closeConfirmation() {
    if (isPending) return;
    setConfirming(false);
    setPreview(null);
    setConfirmationText("");
  }

  function confirmDelete() {
    if (!selected || !preview?.canDelete || confirmationText !== "DELETE" || isPending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteFinancialRecord(entity, selected.id);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        setConfirming(false);
        setPreview(null);
        setConfirmationText("");
        return;
      }
      setMessage({ type: "success", text: `${selected.label} was deleted successfully.` });
      setSelectedId("");
      setQuery("");
      setConfirming(false);
      setPreview(null);
      setConfirmationText("");
      router.refresh();
    });
  }

  return (
    <>
      <section className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-amber-50 p-4 shadow-[0_12px_30px_rgba(127,29,29,.06)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 xl:w-[360px]">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><ShieldAlert className="h-4 w-4" /></span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-red-700">IT Super User financial control</p>
                <p className="text-[12px] font-semibold text-[#1E293B]">{title}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#64748B]">
              Permanent deletion is dependency-aware. Posted accounting history is never cascaded silently; linked records block deletion.
            </p>
          </div>

          <label className="relative min-w-0 flex-1">
            <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">Find record</span>
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-[#94A3B8]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${entityLabel[entity]}...`} className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white pl-9 pr-3 text-[11px]" />
          </label>

          <label className="min-w-0 flex-[1.35]">
            <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">Select exact record</span>
            <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMessage(null); }} className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px]">
              <option value="">Choose a {entityLabel[entity]}</option>
              {filtered.map((record) => <option key={record.id} value={record.id}>{record.label}{record.detail ? ` — ${record.detail}` : ""}</option>)}
            </select>
          </label>

          <button type="button" disabled={!selected || isPending} onClick={beginDelete} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-600 px-4 text-[10.5px] font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Trash2 className="h-4 w-4" />Review deletion
          </button>
        </div>

        {message ? <div className={`mt-3 rounded-xl border px-3 py-2 text-[10.5px] font-medium ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div> : null}
      </section>

      {confirming && selected && preview ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-[#0F172A]/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-3xl border border-white/80 bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,.24)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${preview.canDelete ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {preview.canDelete ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </span>
                <div>
                  <h2 className="text-[16px] font-semibold text-[#0F172A]">{preview.canDelete ? `Permanently delete ${entityLabel[entity]}?` : "Deletion blocked"}</h2>
                  <p className="mt-1 text-[10.5px] leading-4 text-[#64748B]">{preview.label}</p>
                </div>
              </div>
              <button type="button" onClick={closeConfirmation} disabled={isPending} className="grid h-8 w-8 place-items-center rounded-xl text-[#64748B] hover:bg-[#F1F5F9]" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-[#64748B]">Deletion impact</p>
              <ul className="mt-2 space-y-1 text-[10.5px] leading-4 text-[#334155]">
                {preview.cascadeSummary.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>

            {preview.blockers.length ? (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-amber-700">Protected financial references</p>
                <ul className="mt-2 space-y-1 text-[10.5px] leading-4 text-amber-900">
                  {preview.blockers.map((item) => <li key={item}>• {item}</li>)}
                </ul>
                <p className="mt-2 text-[10px] text-amber-800">Remove or reverse the downstream accounting records through their controlled workflow first.</p>
              </div>
            ) : (
              <label className="mt-4 block">
                <span className="text-[10.5px] font-medium text-[#334155]">Type <strong>DELETE</strong> to confirm permanent deletion</span>
                <input autoFocus value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] px-3 text-[12px] font-semibold tracking-[0.08em]" placeholder="DELETE" />
              </label>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeConfirmation} disabled={isPending} className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#475569] disabled:opacity-50">{preview.canDelete ? "Cancel" : "Close"}</button>
              {preview.canDelete ? <button type="button" onClick={confirmDelete} disabled={confirmationText !== "DELETE" || isPending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-[10.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" />{isPending ? "Deleting..." : "Delete permanently"}</button> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
