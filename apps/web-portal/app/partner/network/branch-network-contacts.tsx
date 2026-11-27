"use client";

import { Building2, ChevronDown, Mail, Phone, UserRound } from "lucide-react";
import type { PartnerBranchNetworkContact, PartnerBranchNetworkContacts } from "@/lib/partner-branch-network";

function ContactCard({
  title,
  contact,
  kind,
}: {
  title: string;
  contact: PartnerBranchNetworkContact | null;
  kind: "partner" | "group";
}) {
  const Icon = kind === "partner" ? UserRound : Building2;

  return (
    <details className="group overflow-hidden rounded-xl border border-[#DFE7F2] bg-white shadow-[0_6px_18px_rgba(49,86,184,0.04)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#315FD6]">
            <Icon className="h-4 w-4" />
          </span>
          <p className="truncate text-[12px] font-extrabold text-[#172846]">{title}</p>
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#617895] transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-[#E8EDF4] bg-[#FBFDFF] px-4 py-3.5">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8493A7]">Name</p>
            <p className="mt-1 text-[11px] font-bold text-[#213A60]">{contact?.name || "—"}</p>
          </div>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8493A7]">Phone Number</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-[#213A60]">
              <Phone className="h-3.5 w-3.5 text-[#6F8097]" />
              {contact?.phone || "—"}
            </p>
          </div>
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.08em] text-[#8493A7]">Email</p>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-[#213A60]">
              <Mail className="h-3.5 w-3.5 shrink-0 text-[#6F8097]" />
              <span className="truncate">{contact?.email || "—"}</span>
            </p>
          </div>
        </div>
      </div>
    </details>
  );
}

export function BranchNetworkContacts({ contacts }: { contacts: PartnerBranchNetworkContacts }) {
  return (
    <section className="space-y-2.5">
      <ContactCard title="Branch Partner" contact={contacts.branch_partner} kind="partner" />
      <ContactCard title="Branch Group" contact={contacts.branch_group} kind="group" />
    </section>
  );
}
