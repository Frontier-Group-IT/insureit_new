"use client";

import { useEffect } from "react";

// PolicyOnboardingIntelligence discovers the current policy form from its established
// Policy Onboarding heading. The edit screen intentionally displays "Edit Policy",
// so provide a non-visual compatibility anchor inside the same form root without
// changing the shared intelligence component's new-policy behavior.
export function PolicyEditIntelligenceAnchor() {
  useEffect(() => {
    let anchor: HTMLHeadingElement | null = null;
    const install = () => {
      const editHeading = Array.from(document.querySelectorAll("h1")).find((item) => item.textContent?.trim() === "Edit Policy");
      const root = editHeading?.closest(".mx-auto");
      if (!root) return false;
      if (root.querySelector('[data-policy-intelligence-anchor="edit"]')) return true;
      anchor = document.createElement("h1");
      anchor.textContent = "Policy Onboarding";
      anchor.dataset.policyIntelligenceAnchor = "edit";
      anchor.className = "sr-only";
      root.appendChild(anchor);
      return true;
    };

    if (!install()) {
      const observer = new MutationObserver(() => {
        if (install()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return () => {
        observer.disconnect();
        anchor?.remove();
      };
    }

    return () => anchor?.remove();
  }, []);

  return null;
}
