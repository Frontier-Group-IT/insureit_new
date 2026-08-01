"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REVIEW_ROUTE = /^\/intermediaries\/applications\/([^/]+)\/?$/;
const LEGACY_IMPORT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_LEGACY_INTERMEDIARY_IMPORT === "true";

export function LegacyIntermediaryImportLink() {
  const pathname = usePathname();

  useEffect(() => {
    if (!LEGACY_IMPORT_ENABLED) return;

    const addSidebarLinks = () => {
      addSidebarLink("Add POSP", "Add Existing POSP", "/customers/posp-misp/existing/new?partner_type=posp");
      addSidebarLink("Add MISP", "Add Existing MISP", "/customers/posp-misp/existing/new?partner_type=misp");
    };

    const addReviewLink = () => {
      const match = pathname.match(REVIEW_ROUTE);
      if (!match) return;
      const applicationId = match[1];
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

    const apply = () => {
      addSidebarLinks();
      addReviewLink();
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

function addSidebarLink(anchorLabel: string, newLabel: string, href: string) {
  const marker = `legacy-${newLabel.toLowerCase().replaceAll(" ", "-")}`;
  if (document.querySelector(`[data-${marker}='true']`)) return;

  const anchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("aside a"));
  const anchor = anchors.find((item) => item.textContent?.trim().toLowerCase() === anchorLabel.toLowerCase());
  if (!anchor || !anchor.parentElement) return;

  const link = anchor.cloneNode(true) as HTMLAnchorElement;
  link.href = href;
  link.title = newLabel;
  link.setAttribute(`data-${marker}`, "true");

  const text = link.querySelector("span:last-child");
  if (text) text.textContent = newLabel;
  else link.textContent = newLabel;

  link.classList.remove("bg-white", "text-[#17213e]");
  if (!link.className.includes("text-white/82")) link.className += " text-white/82 hover:bg-white/10 hover:text-white";
  anchor.insertAdjacentElement("afterend", link);
}
