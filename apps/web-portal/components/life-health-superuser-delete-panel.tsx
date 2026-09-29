"use client";

import { AlertTriangle, ChevronDown, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteLifeHealthCase } from "@/app/policies/life-health-cases/delete-actions";

type RecordOption = { id: string; label: string; detail?: string | null; issued: boolean };

export function LifeHealthSuperUserDeletePanel({ records }: { records: RecordOption[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((record) => !q || `${record.label} ${record.detail ?? ""}`.toLowerCase().includes(q)).slice(0, 100);
  }, [query, records]);
  const selected = records.find((record) => record.id === selectedId) ?? null;

  function remove() {
    if (!selected || confirmation !== "DELETE" || pending) return;
    startTransition(async () => {
      const result = await deleteLifeHealthCase(selected.id);
      if (!result.ok) { setMessage({ type: "error", text: result.error }); setConfirming(false); setConfirmation(""); return; }
      setMessage({ type: "success", text: `${selected.label} was deleted successfully.` });
      setSelectedId(""); setQuery(""); setConfirming(false); setConfirmation(""); router.refresh();
    });
  }

  return <>
    <section className="mx-auto mb-3 max-w-[1480px] rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-amber-50 p-3 shadow-[0_12px_30px_rgba(127,29,29,.06)]">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 rounded-xl text-left outline-none transition hover:bg-white/60">
        <span className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><AlertTriangle className="h-4 w-4" /></span><span><span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-red-700">IT Super User only</span><span className="block text-[12px] font-semibold text-[#1E293B]">Delete Life / Health case record</span></span></span>
        <span className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-red-700">{expanded ? "Collapse" : "Expand"}<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
      </button>
      {expanded ? <div className="mt-3 border-t border-red-100 pt-3"><div className="flex flex-col gap-3 xl:flex-row xl:items-end"><p className="min-w-0 text-[10px] leading-4 text-[#64748B] xl:w-[310px]">Permanent deletion is available only for cases that do not have an issued policy linked. Uploaded case documents are cleaned from storage after deletion.</p><label className="relative min-w-0 flex-1"><span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[.05em] text-[#64748B]">Find record</span><Search className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 text-[#94A3B8]"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search Life / Health case..." className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white pl-9 pr-3 text-[11px]"/></label><label className="min-w-0 flex-[1.35]"><span className="mb-1 block text-[9.5px] font-semibold uppercase tracking-[.05em] text-[#64748B]">Select exact record</span><select value={selectedId} onChange={(e)=>{setSelectedId(e.target.value);setMessage(null)}} className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[11px]"><option value="">Choose a case</option>{filtered.map((r)=><option key={r.id} value={r.id}>{r.label}{r.detail ? ` — ${r.detail}` : ""}{r.issued ? " — Issued" : ""}</option>)}</select></label><button type="button" disabled={!selected || pending} onClick={()=>{setMessage(null);setConfirming(true)}} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-600 px-4 text-[10.5px] font-bold text-white disabled:opacity-40"><Trash2 className="h-4 w-4"/>Delete case</button></div>{message?<div className={`mt-3 rounded-xl border px-3 py-2 text-[10.5px] font-medium ${message.type==="success"?"border-emerald-200 bg-emerald-50 text-emerald-700":"border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div>:null}</div>:null}
    </section>
    {confirming && selected ? <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0F172A]/45 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"><div className="flex items-start justify-between"><div><h2 className="text-[16px] font-semibold text-[#0F172A]">Permanently delete Life / Health case?</h2><p className="mt-1 text-[10.5px] text-[#64748B]">This action cannot be undone.</p></div><button onClick={()=>{if(!pending){setConfirming(false);setConfirmation("")}}} className="grid h-8 w-8 place-items-center rounded-xl"><X className="h-4 w-4"/></button></div><div className="mt-4 rounded-2xl border border-red-100 bg-red-50/70 p-3"><p className="text-[9px] font-bold uppercase text-red-600">Selected record</p><p className="mt-1 text-[12px] font-semibold text-[#7F1D1D]">{selected.label}</p>{selected.detail?<p className="mt-0.5 text-[10px] text-[#9F1239]">{selected.detail}</p>:null}{selected.issued?<p className="mt-2 text-[10px] font-semibold text-red-700">This case has an issued policy and server-side protection will block deletion.</p>:null}</div><label className="mt-4 block"><span className="text-[10.5px] text-[#334155]">Type <strong>DELETE</strong> to confirm</span><input autoFocus value={confirmation} onChange={(e)=>setConfirmation(e.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-[#CBD5E1] px-3 text-[12px] font-semibold" placeholder="DELETE"/></label><div className="mt-5 flex justify-end gap-2"><button onClick={()=>{setConfirming(false);setConfirmation("")}} disabled={pending} className="h-10 rounded-xl border border-[#CBD5E1] px-4 text-[10.5px] font-semibold">Cancel</button><button onClick={remove} disabled={confirmation!=="DELETE"||pending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-[10.5px] font-bold text-white disabled:opacity-40"><Trash2 className="h-4 w-4"/>{pending?"Deleting...":"Delete permanently"}</button></div></div></div>:null}
  </>;
}
