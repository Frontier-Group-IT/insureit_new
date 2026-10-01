"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const STAGES = ["primary", "documents", "registration", "training", "agreement", "iib"] as const;

export function WorkflowStageNavigationCompatibility() {
  const router = useRouter();

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Onboarding progress"]');
    const grid = nav?.querySelector<HTMLElement>(":scope > div");
    if (!grid) return;

    const items = Array.from(grid.children).filter((item): item is HTMLElement => item instanceof HTMLElement);
    if (items.length !== STAGES.length) return;

    const cleanups: Array<() => void> = [];

    items.forEach((item, index) => {
      const stage = STAGES[index];
      const completed = item.textContent?.includes("✓") ?? false;
      const active = item.getAttribute("aria-current") === "step";
      const previousCompleted = index > 0 && (items[index - 1]?.textContent?.includes("✓") ?? false);
      const reopenable = completed || active || previousCompleted;

      if (!reopenable) return;

      const openStage = () => {
        const params = new URLSearchParams(window.location.search);
        params.set("stage", stage);
        router.push(`${window.location.pathname}?${params.toString()}`);
      };
      const onClick = () => openStage();
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openStage();
      };

      item.setAttribute("role", "link");
      item.setAttribute("tabindex", "0");
      item.setAttribute("data-workflow-stage", stage);
      item.style.cursor = "pointer";
      item.addEventListener("click", onClick);
      item.addEventListener("keydown", onKeyDown);

      cleanups.push(() => {
        item.removeEventListener("click", onClick);
        item.removeEventListener("keydown", onKeyDown);
        item.removeAttribute("role");
        item.removeAttribute("tabindex");
        item.removeAttribute("data-workflow-stage");
        item.style.removeProperty("cursor");
      });
    });

    return () => cleanups.forEach((cleanup) => cleanup());
  }, [router]);

  return null;
}
