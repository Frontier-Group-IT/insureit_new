"use client";

import { useEffect, useRef, useState } from "react";

export default function ApplicationReviewLayout({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isPartnerReview, setIsPartnerReview] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setIsPartnerReview(root.textContent?.includes("Active Partner") ?? false);
  }, []);

  return (
    <div ref={rootRef} className={isPartnerReview ? "partner-review-compact" : undefined}>
      {children}
      <style jsx global>{`
        .partner-review-compact [class*="max-w-[1480px]"] > nav {
          display: none !important;
        }

        .partner-review-compact #details,
        .partner-review-compact #linked-account,
        .partner-review-compact #account,
        .partner-review-compact #documents,
        .partner-review-compact #activity {
          display: none !important;
        }

        .partner-review-compact #overview > section:nth-of-type(n + 2) {
          display: none !important;
        }

        .partner-review-compact #overview dl > div:nth-child(4),
        .partner-review-compact #overview dl > div:nth-child(5) {
          display: none !important;
        }

        .partner-review-compact #overview dl {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
        }

        .partner-review-compact a[class*="bg-white/10"],
        .partner-review-compact button[class*="bg-white/10"] {
          border-color: #ffffff !important;
          background: #ffffff !important;
          color: #071d49 !important;
        }

        .partner-review-compact a[class*="bg-white/10"]:hover,
        .partner-review-compact button[class*="bg-white/10"]:hover {
          background: #f5f8ff !important;
        }

        @media (max-width: 1023px) {
          .partner-review-compact #overview dl {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 639px) {
          .partner-review-compact #overview dl {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
