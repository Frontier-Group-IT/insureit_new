"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REVIEW_ROUTE = /^\/intermediaries\/applications\/([^/]+)\/?$/;

export function LegacyIntermediaryImportLink() {
  const pathname = usePathname();

  useEffect(() => {
    const match = pathname.match(REVIEW_ROUTE);
    if (!match) return;
    const applicationId = match[1];

    const apply = () => {
      if (document.querySelector("[data-legacy-intermediary-import-link='true']")) return;
      const actions = Array.from(document.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a, button"));
      const createAction = actions.find((action) => {
        const label = action.textContent?.trim().toLowerCase() ?? "";
        return label === "create posp account" || label === "create misp account";
      });
      if (!createAction) return;

      const link = document.createElement("a");
      link.href = `/intermediaries/applications/${applicationId}/legacy-import`;
      link.textContent = "Import existing";
      link.dataset.legacyIntermediaryImportLink = "true";
      link.className = "inline-flex h-10 items-center justify-center rounded-xl border border-white/35 bg-white/10 px-4 text-[10px] font-semibold text-white transition hover:bg-white/20";
      createAction.parentElement?.parentElement?.appendChild(link);
    };

    apply();
    const frame = window.requestAnimationFrame(apply);
    const timer = window.setTimeout(apply, 120);
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname]);

  return null;
}
