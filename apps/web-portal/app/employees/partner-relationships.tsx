"use client";

import { Building2, GitBranch, Users, UserRound } from "lucide-react";
import type { DirectoryPartner } from "./employee-organization-tree";

/** Read-only related records. Account management remains in the authorized Partner portal. */
export function PartnerRelationships({ partner, compact = false }: { partner: DirectoryPartner; compact?: boolean }) {
  const hasBranches = partner.branches.length > 0;
  const hasAssociates = partner.associates.length > 0;
  if (!hasBranches && !hasAssociates) return null;

  return <div className={compact ? "mt-2 space-y-1.5" : "mt-3 space-y-2"} data-testid="partner-relationships">
    <div className="flex flex-wrap items-center gap-1.5 text-[9.5px] text-[#3C7563]">
      {hasBranches ? <span className="rounded-full bg-[#E8F4EF] px-2 py-0.5"><GitBranch className="mr-1 inline h-3 w-3" />{partner.branches.length} branches</span> : null}
      {hasAssociates ? <span className="rounded-full bg-[#E8F4EF] px-2 py-0.5"><Users className="mr-1 inline h-3 w-3" />{partner.associates.length} associates</span> : null}
    </div>
    {hasAssociates ? <details className="org-disclosure rounded-md border border-[#DBEAE2] bg-white/90 p-2 transition-colors hover:border-[#A9D4C2]" data-testid="partner-associate-section">
      <summary className="cursor-pointer list-none text-[10px] font-semibold text-[#235F4F]">
        <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Partner associates <span className="ml-auto text-[#789587]">{partner.associates.length}</span></span>
      </summary>
      <ul className="org-disclosure-content mt-2 max-h-48 space-y-1.5 overflow-y-auto border-t border-[#ECF2EE] pt-2">
        {partner.associates.map((associate) => <li key={associate.id} className="org-interactive-card flex items-start gap-2 rounded-md bg-[#F7FBF8] p-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#E4F0EA] text-[#37725B]"><UserRound className="h-3.5 w-3.5" /></span>
          <span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold text-[#234F43]" title={associate.name}>{associate.name}</span><span className="block truncate text-[9px] text-[#667F76]">{associate.designation || associate.role || "Associate"}</span></span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium capitalize ${associate.status === "active" ? "bg-[#E0F5EA] text-[#167455]" : "bg-[#F1F3F5] text-[#617080]"}`}>{associate.status.replaceAll("_", " ")}</span>
        </li>)}
      </ul>
    </details> : null}
    {hasBranches ? <details className="org-disclosure rounded-md border border-[#DBEAE2] bg-white/90 p-2 transition-colors hover:border-[#A9D4C2]" data-testid="partner-branches-section">
      <summary className="cursor-pointer list-none text-[10px] font-semibold text-[#235F4F]"><span className="flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" />Partner branches <span className="ml-auto text-[#789587]">{partner.branches.length}</span></span></summary>
      <ul className="org-disclosure-content mt-2 max-h-44 space-y-1 overflow-y-auto border-t border-[#ECF2EE] pt-2">
        {partner.branches.map((branch) => <li key={branch.id} className="org-interactive-card flex items-center gap-2 rounded-md bg-[#F7FBF8] px-2 py-1.5 text-[10px] text-[#375E50]"><Building2 className="h-3 w-3 shrink-0" /><span className="min-w-0 flex-1 truncate">{branch.name}</span>{branch.code ? <span className="shrink-0 text-[9px] text-[#789587]">{branch.code}</span> : null}</li>)}
      </ul>
    </details> : null}
  </div>;
}
