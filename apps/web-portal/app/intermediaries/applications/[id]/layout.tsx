"use client";

import { useEffect, useRef, useState } from "react";

export default function ApplicationReviewLayout({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isPartnerReview, setIsPartnerReview] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const text = root.textContent ?? "";
    const partnerReview = text.includes("Individual Partner") || text.includes("Business Partner");
    setIsPartnerReview(partnerReview);

    root.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a, button").forEach((action) => {
      const label = action.textContent?.trim().toLowerCase();
      if (label === "edit details") action.dataset.reviewAction = "edit";
      if (label === "create user") action.dataset.reviewAction = "create-user";
    });

    root.querySelectorAll<HTMLElement>("h1, h2, h3, p, span, dt").forEach((element) => {
      const label = element.textContent?.trim().toLowerCase();

      if (label === "open requirements") {
        element.closest("section")?.setAttribute("data-open-requirements", "true");
      }

      if (label === "portal user status") {
        const stat = element.closest<HTMLElement>("div[class*='items-center']");
        if (stat) {
          stat.dataset.partnerPortalStatus = "true";
          const grid = stat.parentElement;
          if (grid) {
            grid.dataset.reviewHeaderStats = "true";
            if (partnerReview) grid.dataset.partnerHeaderStats = "true";
          }
        }
      }

      if (!partnerReview) return;

      if (label === "partner onboarding journey") {
        element.closest("section")?.setAttribute("data-partner-journey", "true");
      }

      if (label === "onboarding date") {
        const stat = element.closest<HTMLElement>("div[class*='items-center']");
        if (stat) stat.dataset.partnerOnboardingDate = "true";
      }

      if (label === "aadhaar") {
        const field = element.parentElement;
        const value = field?.querySelector<HTMLElement>("dd");
        const current = value?.textContent?.trim() ?? "";
        const lastFour = current.match(/(\d{4})$/)?.[1];
        if (value && lastFour) value.textContent = `****${lastFour}`;
      }
    });
  }, []);

  return (
    <div ref={rootRef} className={isPartnerReview ? "application-review-refined partner-review-refined" : "application-review-refined"}>
      {children}
      <style>{`
        .application-review-refined [data-open-requirements="true"] {
          display: none !important;
        }

        .application-review-refined [data-review-header-stats="true"] {
          width: 100% !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        }

        .application-review-refined [data-review-header-stats="true"] > div {
          width: 100% !important;
          min-width: 0 !important;
        }

        .application-review-refined [data-review-action="edit"],
        .application-review-refined [data-review-action="create-user"] {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.55rem !important;
          min-width: 8rem !important;
          height: 2.5rem !important;
          padding: 0 1rem !important;
          border: 1px solid #ded8ce !important;
          border-radius: 0.85rem !important;
          background: #f3f0e9 !important;
          color: #071d49 !important;
          box-shadow: 0 1px 2px rgba(7, 29, 73, 0.08) !important;
          font-weight: 600 !important;
        }

        .application-review-refined [data-review-action="edit"]::before {
          content: "✎";
          font-size: 0.82rem;
          line-height: 1;
        }

        .application-review-refined [data-review-action="create-user"]::before {
          content: "+";
          display: grid;
          width: 1.05rem;
          height: 1.05rem;
          place-items: center;
          border: 1px solid currentColor;
          border-radius: 999px;
          font-size: 0.72rem;
          line-height: 1;
        }

        .application-review-refined [data-review-action="edit"]:hover,
        .application-review-refined [data-review-action="create-user"]:hover {
          border-color: #cfc7bb !important;
          background: #ebe6dd !important;
        }

        .partner-review-refined [data-partner-journey="true"],
        .partner-review-refined [data-partner-onboarding-date="true"],
        .partner-review-refined #activity {
          display: none !important;
        }

        .partner-review-refined [data-partner-header-stats="true"] {
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        }

        .partner-review-refined [data-partner-portal-status="true"] {
          display: flex !important;
          order: 5 !important;
        }

        .partner-review-refined > div > div[class*="max-w-[1480px]"] {
          gap: 0.85rem !important;
        }

        @media (max-width: 1199px) {
          .application-review-refined [data-review-header-stats="true"],
          .partner-review-refined [data-partner-header-stats="true"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 639px) {
          .application-review-refined [data-review-action="edit"],
          .application-review-refined [data-review-action="create-user"] {
            min-width: auto !important;
          }

          .application-review-refined [data-review-header-stats="true"],
          .partner-review-refined [data-partner-header-stats="true"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
