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

    if (!partnerReview) return;

    root.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a, button").forEach((action) => {
      const label = action.textContent?.trim().toLowerCase();
      if (label === "edit details") action.dataset.partnerAction = "edit";
      if (label === "create user") action.dataset.partnerAction = "create-user";
    });
  }, []);

  return (
    <div ref={rootRef} className={isPartnerReview ? "partner-review-refined" : undefined}>
      {children}
      <style>{`
        .partner-review-refined #overview > section:nth-of-type(2),
        .partner-review-refined #activity {
          display: none !important;
        }

        .partner-review-refined section[class*="bg-gradient-to-br"] > div:last-child > div:last-child {
          display: none !important;
        }

        .partner-review-refined section[class*="bg-gradient-to-br"] > div:last-child {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }

        .partner-review-refined [data-partner-action="edit"],
        .partner-review-refined [data-partner-action="create-user"] {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.45rem !important;
          border: 1px solid rgba(255, 255, 255, 0.78) !important;
          border-radius: 0.75rem !important;
          background: #ffffff !important;
          color: #071d49 !important;
          box-shadow: 0 1px 2px rgba(7, 29, 73, 0.08) !important;
        }

        .partner-review-refined [data-partner-action="edit"]::before {
          content: "✎";
          font-size: 0.8rem;
          line-height: 1;
        }

        .partner-review-refined [data-partner-action="create-user"]::before {
          content: "+";
          display: grid;
          width: 1rem;
          height: 1rem;
          place-items: center;
          border: 1px solid currentColor;
          border-radius: 999px;
          font-size: 0.7rem;
          line-height: 1;
        }

        .partner-review-refined [data-partner-action="edit"]:hover,
        .partner-review-refined [data-partner-action="create-user"]:hover {
          border-color: #cbd5e1 !important;
          background: #f8fafc !important;
        }

        .partner-review-refined > div > div[class*="max-w-[1480px]"] {
          gap: 0.85rem !important;
        }

        @media (max-width: 1279px) {
          .partner-review-refined section[class*="bg-gradient-to-br"] > div:last-child {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 639px) {
          .partner-review-refined section[class*="bg-gradient-to-br"] > div:last-child {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
