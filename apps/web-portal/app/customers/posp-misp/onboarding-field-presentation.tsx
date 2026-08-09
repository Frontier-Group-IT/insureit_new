"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function OnboardingFieldPresentation({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const decorateRequiredLabels = () => {
      root.querySelectorAll<HTMLLabelElement>("label").forEach((label) => {
        if (label.querySelector("[data-required-mark]")) return;

        const nodes = Array.from(label.childNodes);
        const trailingText = [...nodes]
          .reverse()
          .find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trimEnd().endsWith("*"));

        if (!trailingText?.textContent) return;

        const original = trailingText.textContent;
        const starIndex = original.lastIndexOf("*");
        trailingText.textContent = original.slice(0, starIndex).trimEnd();
        label.append(" ");

        const mark = document.createElement("span");
        mark.dataset.requiredMark = "true";
        mark.className = "text-red-600";
        mark.setAttribute("aria-hidden", "true");
        mark.textContent = "*";
        label.append(mark);
      });
    };

    decorateRequiredLabels();
    const observer = new MutationObserver(decorateRequiredLabels);
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="onboarding-neutral-validation">
      {children}
      <style>{`
        .onboarding-neutral-validation input[class~="!border-red-400"],
        .onboarding-neutral-validation select[class~="!border-red-400"],
        .onboarding-neutral-validation textarea[class~="!border-red-400"] {
          border-color: #cbd5e1 !important;
          background-color: #ffffff !important;
          box-shadow: none !important;
        }

        .onboarding-neutral-validation form[data-posp-misp-onboarding-form="true"] > header p,
        .onboarding-neutral-validation form[data-posp-misp-onboarding-form="true"] > .sticky > p {
          display: none !important;
        }

        @media (min-width: 640px) {
          .onboarding-neutral-validation form[data-posp-misp-onboarding-form="true"] > .sticky {
            justify-content: flex-end !important;
          }
        }
      `}</style>
    </div>
  );
}
