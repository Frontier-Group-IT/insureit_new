"use client";

import { Plus, Smartphone, X } from "lucide-react";
import { useState } from "react";

import { PendingButton } from "@/components/voice/pending-button";

export function VoiceQuickAddCard({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid h-7 w-7 place-items-center rounded-lg border border-[#C9D8EB] bg-white text-[#3156B8] transition hover:border-[#9FB5D6] hover:bg-[#F8FAFD]"
          aria-label="Quick add RC"
          title="Quick add RC"
        >
          {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
        {open ? (
          <form
            action="/api/system/voice-integration/quick-add"
            method="post"
            className="absolute right-0 top-9 z-30 w-[min(620px,calc(100vw-2rem))] rounded-xl border border-[#D7E2F0] bg-white p-3 shadow-[0_14px_34px_rgba(31,55,86,0.18)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[.06em] text-[#7486A0]">Quick add to calling queue</p>
                <p className="mt-0.5 text-[8px] text-[#697D97]">Enter RC number and mobile.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-6 w-6 place-items-center rounded-md text-[#7C8EA6] hover:bg-[#F5F7FA]"
                aria-label="Close Quick Add"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="mb-1 block text-[7px] font-black uppercase tracking-[.05em] text-[#8192A7]">RC number</span>
                <input
                  name="registration_no"
                  autoCapitalize="characters"
                  autoComplete="off"
                  required
                  placeholder="MP09AB1234"
                  className="h-8 w-full rounded-lg border border-[#D7E0EA] bg-white px-2.5 text-[8.5px] font-bold uppercase text-[#29415F] outline-none focus:border-[#7894D4] focus:ring-2 focus:ring-[#3156B8]/10"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[7px] font-black uppercase tracking-[.05em] text-[#8192A7]">Mobile number</span>
                <div className="relative">
                  <Smartphone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8798AC]" />
                  <input
                    name="mobile"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    placeholder="10-digit mobile"
                    className="h-8 w-full rounded-lg border border-[#D7E0EA] bg-white pl-8 pr-2.5 text-[8.5px] font-bold text-[#29415F] outline-none focus:border-[#7894D4] focus:ring-2 focus:ring-[#3156B8]/10"
                  />
                </div>
              </label>

              <div className="flex items-end">
                <PendingButton
                  pendingLabel="Adding…"
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-[#102A56] px-3 text-[8px] font-bold text-white disabled:cursor-wait disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </PendingButton>
              </div>
            </div>
          </form>
        ) : null}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#C9D8EB] bg-white px-3 text-[8.5px] font-bold text-[#3156B8] shadow-[0_2px_8px_rgba(49,86,184,0.05)] transition hover:border-[#9FB5D6] hover:bg-[#F8FAFD]"
      >
        <Plus className="h-3.5 w-3.5" />
        Quick add RC
      </button>
    );
  }

  return (
    <form
      action="/api/system/voice-integration/quick-add"
      method="post"
      className="w-full rounded-xl border border-[#D7E2F0] bg-[#F9FBFE] p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[.06em] text-[#7486A0]">Quick add to calling queue</p>
          <p className="mt-0.5 text-[8.5px] text-[#697D97]">
            Enter RC number and mobile. INSUREIT will fetch the vehicle and insurer context automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="grid h-7 w-7 place-items-center rounded-lg text-[#7C8EA6] transition hover:bg-white hover:text-[#29415F]"
          aria-label="Close Quick Add"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[7px] font-black uppercase tracking-[.05em] text-[#8192A7]">RC number</span>
          <input
            name="registration_no"
            autoCapitalize="characters"
            autoComplete="off"
            required
            placeholder="MP09AB1234"
            className="h-9 w-full rounded-lg border border-[#D7E0EA] bg-white px-3 text-[9px] font-bold uppercase text-[#29415F] outline-none transition placeholder:font-medium placeholder:text-[#A4B0C0] focus:border-[#7894D4] focus:ring-2 focus:ring-[#3156B8]/10"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[7px] font-black uppercase tracking-[.05em] text-[#8192A7]">Mobile number</span>
          <div className="relative">
            <Smartphone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8798AC]" />
            <input
              name="mobile"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="10-digit mobile number"
              className="h-9 w-full rounded-lg border border-[#D7E0EA] bg-white pl-8 pr-3 text-[9px] font-bold text-[#29415F] outline-none transition placeholder:font-medium placeholder:text-[#A4B0C0] focus:border-[#7894D4] focus:ring-2 focus:ring-[#3156B8]/10"
            />
          </div>
        </label>

        <div className="flex items-end">
          <PendingButton
            pendingLabel="Adding & fetching…"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#102A56] px-4 text-[8.5px] font-bold text-white shadow-[0_4px_12px_rgba(16,42,86,0.12)] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Add & fetch
          </PendingButton>
        </div>
      </div>

      <p className="mt-2 text-[7.5px] text-[#8798AC]">
        If the RC already exists, INSUREIT reuses that prospect, applies this mobile number to the AI calling profile, and refreshes RC details instead of creating a duplicate.
      </p>
    </form>
  );
}
