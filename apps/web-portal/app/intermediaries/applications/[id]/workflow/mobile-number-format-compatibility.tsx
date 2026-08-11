"use client";

import { useEffect } from "react";

const INDIAN_MOBILE_PATTERN = "[6-9][0-9]{9}|[+]91[6-9][0-9]{9}";
const MOBILE_FIELD_SELECTOR = 'input[name="applicant_phone"], input[name="dp_phone"]';

export function MobileNumberFormatCompatibility() {
  useEffect(() => {
    const applyMobilePattern = () => {
      document.querySelectorAll<HTMLInputElement>(MOBILE_FIELD_SELECTOR).forEach((input) => {
        input.pattern = INDIAN_MOBILE_PATTERN;
      });
    };

    applyMobilePattern();

    const observer = new MutationObserver(applyMobilePattern);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
