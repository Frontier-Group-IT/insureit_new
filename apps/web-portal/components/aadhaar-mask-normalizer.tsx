"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function maskAadhaarValues(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>("dt").forEach((label) => {
    if (label.textContent?.trim().toLowerCase() !== "aadhaar") return;

    const field = label.parentElement;
    const value = field?.querySelector<HTMLElement>("dd");
    const current = value?.textContent?.trim() ?? "";
    const lastFour = current.match(/(\d{4})$/)?.[1];

    if (value && lastFour && current !== `****${lastFour}`) {
      value.textContent = `****${lastFour}`;
    }
  });
}

export function AadhaarMaskNormalizer() {
  const pathname = usePathname();

  useEffect(() => {
    maskAadhaarValues();

    const observer = new MutationObserver(() => maskAadhaarValues());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
