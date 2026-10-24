"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

export function CustomerClaimClickableRow({ href, label, children }: {
  href: string; label: string; children: ReactNode;
}) {
  const router = useRouter();
  const open = (event: MouseEvent<HTMLTableRowElement>) => {
    if (event.defaultPrevented || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("a,button,input,select,textarea,[role=button]")) return;
    if (event.metaKey || event.ctrlKey) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(href);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      router.push(href);
    }
  };
  return <tr role="link" tabIndex={0} aria-label={label} onClick={open} onKeyDown={onKeyDown}
    className="group relative cursor-pointer border-b border-[#E1E9F4] transition-colors hover:bg-[#EDF5FF] focus:bg-[#EDF5FF] focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-[#1769DC] last:border-b-0">
    {children}
  </tr>;
}
