"use client";

import type { MouseEvent, ReactNode } from "react";

export function AccountReviewBackLink({ href }: { href: string }) {
  function handleClick() {
    window.location.assign(freshUrl(href));
  }

  return (
    <button type="button" onClick={handleClick} className="text-[10px] font-semibold text-[#4F46E5] hover:underline">
      Back to account review
    </button>
  );
}

export function FreshAccountReviewLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    window.location.assign(freshUrl(href));
  }

  return (
    <a href={freshUrl(href)} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

function freshUrl(href: string) {
  return `${href}${href.includes("?") ? "&" : "?"}fresh=${Date.now()}`;
}
