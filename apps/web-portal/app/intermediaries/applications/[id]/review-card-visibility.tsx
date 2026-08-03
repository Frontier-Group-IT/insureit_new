"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

export function ReviewCardVisibility({ applicationId, children }: { applicationId: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== `/intermediaries/applications/${applicationId}`) {
      setTarget(null);
      return;
    }

    const header = document.querySelector<HTMLElement>("section.bg-gradient-to-br");
    const actionRow = Array.from(header?.querySelectorAll<HTMLElement>("div.flex.flex-wrap.items-center.gap-2") ?? [])
      .find((element) => Boolean(element.querySelector("a, form, button")));

    if (!actionRow) return;

    const mount = document.createElement("div");
    mount.dataset.iibPanHeaderStatus = "true";
    mount.className = "shrink-0";
    actionRow.prepend(mount);
    setTarget(mount);

    return () => {
      setTarget(null);
      mount.remove();
    };
  }, [applicationId, pathname]);

  if (pathname !== `/intermediaries/applications/${applicationId}` || !target) return null;
  return createPortal(children, target);
}
