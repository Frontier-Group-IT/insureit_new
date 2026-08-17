"use client";

import { AlertTriangle, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteMasterRecord, type DeletableMasterEntity } from "@/app/master-record-delete-actions";

type DeleteRecordOption = {
  id: string;
  label: string;
  detail?: string | null;
};

type Props = {
  entity: DeletableMasterEntity;
  title: string;
  records: DeleteRecordOption[];
};

const entityLabels: Record<DeletableMasterEntity, string> = {
  customer: "customer",
  customer_onboarding_application: "onboarding application",
  vehicle: "vehicle",
  policy: "policy",
  external_policy: "external policy",
  claim: "claim"
};

export function ItSuperUserDeletePanel({ entity, title, records }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return records.slice(0, 100);
    return records
      .filter((record) => `${record.label} ${record.detail ?? ""}`.toLowerCase().includes(normalized))
      .slice(0, 100);
  }, [query, records]);

  const selected = records.find((record) => record.id === selectedId) ?? null;
  const entityLabel = entityLabels[entity];
  const isClaim = entity === "claim";
  const isCustomerApplication = entity === "customer_onboarding_application";

  function closeConfirmation() {
    if (isPending) return;
    setConfirming(false);
    setConfirmationText("");
  }

  function confirmDelete() {
    if (!selected || confirmationText !== "DELETE" || isPending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteMasterRecord(entity, selected.id);
      if (!result.ok) {
        setMessage({ type: "error", text: result.error });
        setConfirming(false);
        setConfirmationText("");
        return;
      }

      setMessage({ type: "success", text: `${selected.label} was deleted successfully.` });
      setSelectedId("");
      setQuery("");
      setConfirming(false);
      setConfirmationText("");
      router.refresh();
    });
  }

  return (
    <>
      <section className="mx-auto mb-3 max-w-[1440px] rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-amber-50 p-3 shadow-[0_12px_30px_rgba(127,29,29,.06)]">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
          <div className="min-w-0 xl:w-[310px]">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><AlertTriangle className="h-4 w-4" /></span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-red-700">IT Super User only</p>
                <p className="text-[12px] font-semibold text-[#1E293B]">{title}</p>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#64748B]">
              {isClaim
                ? "Permanent claim deletion also removes claim-linked workflow rows through the database cascade. Linked claim document files are cleaned from storage after deletion."
                : isCustomerApplication
                  ? "Permanent deletion removes this onboarding application, its application contacts and document metadata, and attempts to clean its uploaded files. Any customer already created from the application remains intact."
                  : `Permanent deletion is blocked when this ${entityLabel} still has dependent master or claim records.`}
            </p>
          </div>

          <label className="relative min-w-0 flex-1">
            <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">Find record</span>
            <Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-[#94A3B8]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${entityLabel}...`} className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white pl-9 pr-3 text-[11px]" />
          </label>

          <label className="min-w-0 flex-[1.35]">
            <span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[#64748B]">Select exact record</span>
            <select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setMessage(null); }} className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px]">
              <option value="">Choose a {entityLabel}</option>
              {filtered.map((record) => <option key={record.id} value={record.id}>{record.label}{record.detail ? ` — ${record.detail}` : ""}</option>)}
            </select>
          </label>

          <button type="button" disabled={!selected || isPending} onClick={() => { setMessage(null); setConfirming(true); }} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-600 px-4 text-[10.5px] font-bold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">
            <Trash2 className="h-4 w-4" />Delete {entityLabel}
          </button>
        </div>

        {message ? <div className={`mt-3 rounded-xl border px-3 py-2 text-[10.5px] font-medium ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div> : null}
      </section>

      {confirming && selected ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0F172A]/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby={`delete-${entity}-title`}>
          <div className="w-full max-w-md rounded-3xl border border-white/80 bg-white p-5 shadow-[0_30px_90px_rgba(15,23,42,.24)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-700"><Trash2 className="h-5 w-5" /></span>
                <div><h2 id={`delete-${entity}-title`} className="font-display text-[16px] font-semibold text-[#0F172A]">Permanently delete {entityLabel}?</h2><p className="mt-1 text-[10.5px] leading-4 text-[#64748B]">This action cannot be undone.</p></div>
              </div>
              <button type="button" onClick={closeConfirmation} disabled={isPending} className="grid h-8 w-8 place-items-center rounded-xl text-[#64748B] hover:bg-[#F1F5F9]" aria-label="Close delete confirmation"><X className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/70 p-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.05em] text-red-600">Selected record</p>
              <p className="mt-1 break-words text-[12px] font-semibold text-[#7F1D1D]">{selected.label}</p>
              {selected.detail ? <p className="mt-0.5 break-words text-[10px] text-[#9F1239]">{selected.detail}</p> : null}
              {isClaim ? <p className="mt-2 text-[10px] leading-4 text-[#9F1239]">Deleting this claim removes its linked claim documents metadata, status history, tasks and notifications. The policy, vehicle and customer remain intact.</p> : null}
              {isCustomerApplication ? <p className="mt-2 text-[10px] leading-4 text-[#9F1239]">If this application has already created a customer record, that customer and its vehicles, policies and claims will remain unchanged.</p> : null}
            </div>

            <label className="mt-4 block">
              <span className="text-[10.5px] font-medium text-[#334155]">Type <strong>DELETE</strong> to confirm</span>
              <input autoFocus value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] px-3 text-[12px] font-semibold tracking-[0.08em]" placeholder="DELETE" />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeConfirmation} disabled={isPending} className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10.5px] font-semibold text-[#475569] disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={confirmationText !== "DELETE" || isPending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-[10.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                <Trash2 className="h-4 w-4" />{isPending ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
