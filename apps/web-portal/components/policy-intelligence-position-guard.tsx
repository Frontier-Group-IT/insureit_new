"use client";

import { useEffect } from "react";

function findPanelWrapper() {
  const title = Array.from(document.querySelectorAll("h3")).find((item) => item.textContent?.trim() === "Booking control centre");
  return title?.closest("div.fixed") as HTMLElement | null;
}

function findOnboardingHeader() {
  const title = Array.from(document.querySelectorAll("h1")).find((item) => item.textContent?.trim() === "Policy Onboarding");
  return title?.closest(".mb-4") as HTMLElement | null;
}

function findActionBar() {
  return Array.from(document.querySelectorAll("div.fixed.bottom-0"))[0] as HTMLElement | undefined;
}

export function PolicyIntelligencePositionGuard() {
  useEffect(() => {
    let frame = 0;

    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panel = findPanelWrapper();
        const onboardingHeader = findOnboardingHeader();
        if (!panel || !onboardingHeader || window.innerWidth < 1280) return;

        const headerBottom = onboardingHeader.getBoundingClientRect().bottom;
        const top = Math.max(104, headerBottom + 12);
        const actionBarTop = findActionBar()?.getBoundingClientRect().top ?? window.innerHeight - 58;
        const availableHeight = Math.max(420, actionBarTop - top - 16);
        const height = Math.min(500, availableHeight);

        panel.style.setProperty("top", `${top}px`, "important");
        panel.style.setProperty("height", `${height}px`, "important");
        panel.style.setProperty("max-height", `${height}px`, "important");
      });
    };

    apply();
    const interval = window.setInterval(apply, 150);
    window.addEventListener("resize", apply);
    window.addEventListener("scroll", apply, true);

    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("resize", apply);
      window.removeEventListener("scroll", apply, true);
    };
  }, []);

  return null;
}
