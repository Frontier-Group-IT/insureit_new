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
    let frame: number | null = null;
    const scheduleMask = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        maskAadhaarValues();
      });
    };

    maskAadhaarValues();

    const observer = new MutationObserver(scheduleMask);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return null;
}
