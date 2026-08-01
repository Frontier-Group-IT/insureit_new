"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function PartnerLinkedAccountHeaderNormalizer() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  useEffect(() => {
    if (!/^\/intermediaries\/applications\/[^/]+$/.test(pathname)) return;

    const refine = () => {
      const labels = Array.from(document.querySelectorAll<HTMLElement>("p"));
      const accountTypeLabel = labels.find((element) => element.textContent?.trim().toLowerCase() === "account type");
      if (!accountTypeLabel) return;

      const accountTypeCard = accountTypeLabel.closest<HTMLElement>("div[class*='items-center']");
      const accountTypeValue = accountTypeCard?.querySelectorAll<HTMLElement>("p")[1]?.textContent?.trim().toLowerCase() ?? "";
      const linkedType = accountTypeValue.includes("business") ? "MISP" : "POSP";

      const allActions = Array.from(document.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a, button"));
      const linkedAction = allActions.find((action) => {
        const label = action.textContent?.trim().toLowerCase() ?? "";
        return label === "open linked account" || label === "open posp account" || label === "open misp account" || label === "view posp account" || label === "view misp account";
      });
      const createAction = allActions.find((action) => {
        const label = action.textContent?.trim().toLowerCase() ?? "";
        return label === "create posp account" || label === "create misp account";
      });

      if (linkedAction) linkedAction.textContent = `View ${linkedType} Account`;

      const linkedAccountLabel = labels.find((element) => element.textContent?.trim().toLowerCase() === "linked account");
      const linkedAccountCard = linkedAccountLabel?.closest<HTMLElement>("div[class*='items-center']");
      const linkedAccountValue = linkedAccountCard?.querySelectorAll<HTMLElement>("p")[1];
      if (linkedAccountValue) {
        linkedAccountValue.textContent = linkedAction && !createAction ? `${linkedType} Created` : `${linkedType} Not Created`;
      }

      const partnerIdLabel = labels.find((element) => element.textContent?.trim().toLowerCase() === "partner id");
      const partnerIdCard = partnerIdLabel?.closest<HTMLElement>("div[class*='items-center']");
      const metricsGrid = partnerIdCard?.parentElement ?? linkedAccountCard?.parentElement;
      partnerIdCard?.remove();

      if (metricsGrid) metricsGrid.dataset.partnerSummaryFourColumns = "true";
    };

    refine();
    const frame = window.requestAnimationFrame(refine);
    const timer = window.setTimeout(refine, 100);
    const observer = new MutationObserver(refine);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [pathname, searchKey]);

  return (
    <style>{`
      [data-partner-summary-four-columns="true"] {
        grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      }

      @media (max-width: 1199px) {
        [data-partner-summary-four-columns="true"] {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
      }

      @media (max-width: 639px) {
        [data-partner-summary-four-columns="true"] {
          grid-template-columns: minmax(0, 1fr) !important;
        }
      }
    `}</style>
  );
}
