"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

export function AccountStatusHeaderStat({ applicationId, value }: { applicationId: string; value: string }) {
  const pathname = usePathname();
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const expectedPath = `/intermediaries/applications/${applicationId}`;
    if (pathname.replace(/\/$/, "") !== expectedPath) return;

    const labels = Array.from(document.querySelectorAll("p"));
    const accountTypeLabel = labels.find((element) => element.textContent?.trim().toLowerCase() === "account type");
    const accountTypeStat = accountTypeLabel?.parentElement?.parentElement;
    const statGrid = accountTypeStat?.parentElement;
    if (!accountTypeStat || !statGrid) return;

    const mount = document.createElement("div");
    mount.dataset.accountStatusHeaderStat = "true";
    accountTypeStat.insertAdjacentElement("afterend", mount);

    statGrid.classList.remove("xl:grid-cols-5");
    statGrid.classList.add("xl:grid-cols-6");
    setMountNode(mount);

    return () => {
      mount.remove();
      statGrid.classList.remove("xl:grid-cols-6");
      statGrid.classList.add("xl:grid-cols-5");
      setMountNode(null);
    };
  }, [applicationId, pathname]);

  if (!mountNode) return null;

  return createPortal(
    <div className="flex min-w-0 items-center gap-3 border-white/15 px-4 py-4 xl:border-r">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-[8px] font-semibold uppercase tracking-[.05em] text-white/60">Account Status</p>
        <p className="mt-1 truncate text-[10.5px] font-semibold text-white">{value}</p>
      </div>
    </div>,
    mountNode,
  );
}
