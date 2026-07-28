"use client";

import { useEffect, useRef, type ReactNode } from "react";

const INVALID_CLASSES = ["!border-red-400", "!bg-red-50", "!ring-2", "!ring-red-100"];

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

    const removeValidationHighlighting = () => {
      root
        .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input,select,textarea")
        .forEach((element) => element.classList.remove(...INVALID_CLASSES));
    };

    const refreshPresentation = () => {
      decorateRequiredLabels();
      removeValidationHighlighting();
    };

    refreshPresentation();
    const observer = new MutationObserver(refreshPresentation);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
