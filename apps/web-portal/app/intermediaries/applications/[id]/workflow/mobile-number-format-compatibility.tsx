"use client";

import { useEffect } from "react";

const INDIAN_MOBILE_PATTERN = "[6-9][0-9]{9}|[+]91[6-9][0-9]{9}";
const MOBILE_FIELD_SELECTOR = 'input[name="applicant_phone"], input[name="dp_phone"]';

function applyMobilePattern(input: HTMLInputElement) {
  if (input.pattern !== INDIAN_MOBILE_PATTERN) input.pattern = INDIAN_MOBILE_PATTERN;
}

function applyMobilePatterns(root: ParentNode = document) {
  root.querySelectorAll<HTMLInputElement>(MOBILE_FIELD_SELECTOR).forEach(applyMobilePattern);
}

export function MobileNumberFormatCompatibility() {
  useEffect(() => {
    applyMobilePatterns();

    const handleMobileFieldEvent = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.matches(MOBILE_FIELD_SELECTOR)) applyMobilePattern(target);
    };

    document.addEventListener("focusin", handleMobileFieldEvent, true);
    document.addEventListener("input", handleMobileFieldEvent, true);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes" && mutation.target instanceof HTMLInputElement && mutation.target.matches(MOBILE_FIELD_SELECTOR)) {
          applyMobilePattern(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node instanceof HTMLInputElement && node.matches(MOBILE_FIELD_SELECTOR)) applyMobilePattern(node);
          applyMobilePatterns(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["pattern"] });

    return () => {
      document.removeEventListener("focusin", handleMobileFieldEvent, true);
      document.removeEventListener("input", handleMobileFieldEvent, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
