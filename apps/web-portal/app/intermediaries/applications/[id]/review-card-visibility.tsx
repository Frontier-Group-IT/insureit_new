"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

export function ReviewCardVisibility({ applicationId, children }: { applicationId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const reviewPath = `/intermediaries/applications/${applicationId}`;
    const workflowPath = `/intermediaries/applications/${applicationId}/workflow`;
    const isReviewPage = pathname === reviewPath;
    const isWorkflowPage = pathname === workflowPath;

    if (!isReviewPage && !isWorkflowPage) {
      setTarget(null);
      return;
    }

    let host: HTMLElement | null = null;
    let hiddenElements: HTMLElement[] = [];

    if (isReviewPage) {
      const header = document.querySelector<HTMLElement>("section.bg-gradient-to-br");
      host = Array.from(header?.querySelectorAll<HTMLElement>("div.flex.flex-wrap.items-center.gap-2") ?? [])
        .find((element) => Boolean(element.querySelector("a, form, button"))) ?? null;
    } else {
      const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h1"))
        .find((element) => element.closest("section")?.textContent?.includes("IIB"));
      const header = heading?.closest<HTMLElement>("section") ?? null;
      host = Array.from(header?.querySelectorAll<HTMLElement>("div.flex.flex-wrap.items-center") ?? [])
        .find((element) => element.textContent?.includes("IIB check")) ?? null;

      if (host) {
        hiddenElements = Array.from(host.children).filter((element): element is HTMLElement => element instanceof HTMLElement);
        hiddenElements.forEach((element) => {
          element.dataset.previousDisplay = element.style.display;
          element.style.display = "none";
        });
      }
    }

    if (!host) return;

    const mount = document.createElement("div");
    mount.dataset.iibPanHeaderStatus = "true";
    mount.className = "shrink-0";
    host.prepend(mount);
    setTarget(mount);

    return () => {
      setTarget(null);
      mount.remove();
      hiddenElements.forEach((element) => {
        element.style.display = element.dataset.previousDisplay ?? "";
        delete element.dataset.previousDisplay;
      });
    };
  }, [applicationId, pathname]);

  const reviewPath = `/intermediaries/applications/${applicationId}`;
  const workflowPath = `/intermediaries/applications/${applicationId}/workflow`;
  if ((pathname !== reviewPath && pathname !== workflowPath) || !target) return null;
  return createPortal(children, target);
}
