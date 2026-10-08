"use client";

import { useState } from "react";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function CustomerProfileEditor({
  customerId,
  name,
  phone,
  email,
  address,
}: {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ name, phone, email, address });

  async function save() {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/customer/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, ...draft }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) return setMessage(body.error || "Your contact details could not be saved.");
      setEditing(false);
      setMessage("Contact details saved.");
      router.refresh();
    } catch {
      setMessage("Your contact details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const input = "h-10 w-full rounded-xl border border-[#D8E1EC] bg-white px-3 text-[11px] font-semibold text-[#10213D] outline-none focus:border-[#8EACD1]";

  if (!editing) {
    return (
      <div>
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6E0EB] bg-white px-3 py-2 text-[10px] font-black text-[#33445E]">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </button>
        {message ? <p className="mt-2 text-[10px] font-bold text-[#0B7A54]">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[#DDE5EF] bg-[#F8FAFD] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[#718096]">Full name<input className={`${input} mt-1.5`} value={draft.name} onChange={(e) => setDraft((v) => ({...v,name:e.target.value}))} /></label>
        <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[#718096]">Mobile<input className={`${input} mt-1.5`} value={draft.phone} onChange={(e) => setDraft((v) => ({...v,phone:e.target.value}))} /></label>
        <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[#718096]">Email<input className={`${input} mt-1.5`} value={draft.email} onChange={(e) => setDraft((v) => ({...v,email:e.target.value}))} /></label>
        <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[#718096]">Address<input className={`${input} mt-1.5`} value={draft.address} onChange={(e) => setDraft((v) => ({...v,address:e.target.value}))} /></label>
      </div>
      {message ? <p className="rounded-lg bg-[#FFF0F0] px-3 py-2 text-[10px] font-bold text-[#A13B3B]">{message}</p> : null}
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#142746] px-3 py-2 text-[10px] font-black text-white disabled:opacity-60">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save</button>
        <button type="button" disabled={busy} onClick={() => { setEditing(false); setDraft({name,phone,email,address}); setMessage(""); }} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6E0EB] bg-white px-3 py-2 text-[10px] font-black text-[#53627A]"><X className="h-3.5 w-3.5" /> Cancel</button>
      </div>
    </div>
  );
}