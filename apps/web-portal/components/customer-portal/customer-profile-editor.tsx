"use client";

import { useState } from "react";
import { FileText, Loader2, Mail, MapPin, Pencil, Phone, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";

export function CustomerProfileEditor({
  customerId,
  name,
  phone,
  email,
  address,
  city,
  state,
  postalCode,
  documentsCount,
}: {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  documentsCount: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({ name, phone, email, address });

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/customer/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, ...draft }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        setMessage(body.error || "Your contact details could not be saved.");
        return;
      }
      setEditing(false);
      setMessage("Contact details saved.");
      router.refresh();
    } catch {
      setMessage("Your contact details could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    if (busy) return;
    setEditing(false);
    setDraft({ name, phone, email, address });
    setMessage("");
  }

  const input = "h-10 w-full rounded-xl border border-[#D8E1EC] bg-white px-3 text-[11px] font-semibold text-[#2D2352] outline-none focus:border-[#8EACD1] focus:ring-2 focus:ring-[#DDEBFA]";

  return (
    <>
      {!editing ? (
        <>
          <div className="absolute right-4 top-4 sm:right-5 sm:top-5">
            <button
              type="button"
              onClick={() => { setMessage(""); setEditing(true); }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#E4DAFB] bg-[#F4EEFF] px-3.5 py-2 text-[10px] font-black text-[#6742BB] transition hover:bg-[#EBE0FF]"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            {message ? <p className="mt-2 text-right text-[10px] font-bold text-[#0B7A54]">{message}</p> : null}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="customer-profile-detail-card flex min-w-0 items-center gap-2.5 rounded-2xl bg-[#F8F5FF] px-3.5 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#EBE3FF] text-[#7246D3]"><Phone className="h-3.5 w-3.5" /></span>
              <div className="min-w-0"><p className="text-[9.5px] font-bold text-[#81739B]">Mobile Number</p><p className="mt-0.5 break-all text-[11px] font-black text-[#2D2352]">{phone || "—"}</p></div>
            </div>
            <div className="customer-profile-detail-card flex min-w-0 items-center gap-2.5 rounded-2xl bg-[#F8F5FF] px-3.5 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#EBE3FF] text-[#7246D3]"><Mail className="h-3.5 w-3.5" /></span>
              <div className="min-w-0"><p className="text-[9.5px] font-bold text-[#81739B]">Email Address</p><p className="mt-0.5 break-all text-[11px] font-black text-[#2D2352]">{email || "—"}</p></div>
            </div>
            <div className="customer-profile-detail-card flex min-w-0 items-start gap-2.5 rounded-2xl bg-[#F8F5FF] px-3.5 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#EBE3FF] text-[#7246D3]"><MapPin className="h-3.5 w-3.5" /></span>
              <div className="min-w-0">
                <p className="text-[9.5px] font-bold text-[#81739B]">Location</p>
                <p className="mt-0.5 text-[11px] font-black text-[#2D2352]">{[city, state].filter(Boolean).join(", ") || "—"}</p>
                {address ? <p className="mt-0.5 text-[9.5px] font-bold leading-4 text-[#81739B]">{address}{postalCode ? ` · ${postalCode}` : ""}</p> : null}
              </div>
            </div>
            <div className="customer-profile-detail-card flex min-w-0 items-center gap-2.5 rounded-2xl bg-[#F8F5FF] px-3.5 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#EBE3FF] text-[#7246D3]"><FileText className="h-3.5 w-3.5" /></span>
              <div className="min-w-0"><p className="text-[9.5px] font-bold text-[#81739B]">Total Documents</p><p className="mt-0.5 text-[11px] font-black text-[#2D2352]">{documentsCount}</p></div>
            </div>
          </div>
        </>
      ) : (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061B3B]/55 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="customer-profile-edit-title">
          <div className="w-full max-w-[620px] rounded-2xl border border-[#D9E3EF] bg-white shadow-[0_24px_70px_rgba(6,27,59,.24)]">
            <div className="flex items-center justify-between border-b border-[#E6EDF5] px-5 py-4">
              <div>
                <h3 id="customer-profile-edit-title" className="text-[16px] font-black text-[#2D2352]">Edit Profile</h3>
                <p className="mt-1 text-[10px] text-[#81739B]">Update your contact information.</p>
              </div>
              <button type="button" disabled={busy} onClick={cancel} className="grid h-8 w-8 place-items-center rounded-lg text-[#6C7D94] transition hover:bg-[#F1F5F9] disabled:opacity-50" aria-label="Close edit profile">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[#718096]">Full name<input className={`${input} mt-1.5`} value={draft.name} onChange={(e) => setDraft((v) => ({ ...v, name: e.target.value }))} /></label>
                <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[#718096]">Mobile<input className={`${input} mt-1.5`} value={draft.phone} onChange={(e) => setDraft((v) => ({ ...v, phone: e.target.value }))} /></label>
                <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[#718096]">Email<input className={`${input} mt-1.5`} value={draft.email} onChange={(e) => setDraft((v) => ({ ...v, email: e.target.value }))} /></label>
                <label className="text-[9px] font-black uppercase tracking-[0.1em] text-[#718096]">Address<input className={`${input} mt-1.5`} value={draft.address} onChange={(e) => setDraft((v) => ({ ...v, address: e.target.value }))} /></label>
              </div>

              {message ? <p className="mt-3 rounded-lg bg-[#FFF0F0] px-3 py-2 text-[10px] font-bold text-[#A13B3B]">{message}</p> : null}

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={cancel} className="inline-flex items-center gap-1.5 rounded-lg border border-[#D6E0EB] bg-white px-4 py-2.5 text-[10px] font-black text-[#53627A] disabled:opacity-60">
                  Cancel
                </button>
                <button type="button" disabled={busy} onClick={() => void save()} className="inline-flex items-center gap-1.5 rounded-lg bg-[#142746] px-4 py-2.5 text-[10px] font-black text-white disabled:opacity-60">
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
