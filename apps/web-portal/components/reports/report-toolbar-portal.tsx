"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ReportToolbarPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById("reports-workspace-toolbar"));
    return () => setTarget(null);
  }, []);

  return target ? createPortal(children, target) : null;
}
