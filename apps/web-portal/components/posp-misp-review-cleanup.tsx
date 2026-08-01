"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REVIEW_ROUTE = /^\/intermediaries\/applications\/[^/]+\/?$/;

export function PospMispReviewCleanup() {
  const pathname = usePathname();

  useEffect(() => {
    if (!REVIEW_ROUTE.test(pathname)) return;

    let applying = false;

    const apply = () => {
      if (applying) return;
      applying = true;

      try {
        const accountSection = document.querySelector<HTMLElement>("#account");
        if (!accountSection) return;

        const parentPartnerField = Array.from(accountSection.querySelectorAll<HTMLElement>("dt")).find(
          (item) => item.textContent?.trim().toLowerCase() === "parent partner:",
        );
        const parentPartnerId = parentPartnerField?.parentElement?.querySelector<HTMLElement>("dd")?.textContent?.trim();

        if (parentPartnerId) {
          const idLabel = Array.from(document.querySelectorAll<HTMLElement>("p")).find((item) =>
            /^(posp|misp) id$/i.test(item.textContent?.trim() ?? ""),
          );
          const metric = idLabel?.closest<HTMLElement>("div[class*='items-center']");
          const value = metric?.querySelectorAll<HTMLElement>("p")[1];

          if (idLabel) idLabel.textContent = "Parent Partner";
          if (value) value.textContent = parentPartnerId;
        }

        Array.from(document.querySelectorAll<HTMLElement>("span")).forEach((badge) => {
          if (/^(posp|misp) onboarding\b/i.test(badge.textContent?.trim() ?? "")) badge.remove();
        });

        accountSection.remove();
      } finally {
        applying = false;
      }
    };

    apply();
    const frame = window.requestAnimationFrame(apply);
    const timer = window.setTimeout(apply, 100);
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
