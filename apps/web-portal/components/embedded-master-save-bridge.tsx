"use client";

import { useEffect, useState } from "react";

type MasterKind = "customer" | "vehicle";

const STORAGE_KEY = "insureit:policy-master-save-success";

function successKindFromLocation(): MasterKind | null {
  const params = new URLSearchParams(window.location.search);
  const success = params.get("success");
  if (!success) return null;

  if (window.location.pathname === "/vehicles" && success === "vehicle_updated") return "vehicle";
  if (window.location.pathname === "/customers" && ["customer_updated", "documents_uploaded", "dealership_updated"].includes(success)) return "customer";
  if (/^\/customers\/[^/]+\/edit$/.test(window.location.pathname) && success === "corporate_updated") return "customer";
  return null;
}

export function EmbeddedMasterSaveBridge() {
  const [toast, setToast] = useState<MasterKind | null>(null);

  useEffect(() => {
    const kind = successKindFromLocation();
    if (window.self !== window.top && kind) {
      try {
        window.parent.sessionStorage.setItem(STORAGE_KEY, kind);
        window.parent.location.reload();
      } catch {
        // The embedded editor is same-origin in normal operation. If that ever changes,
        // leave the page intact rather than attempting an unsafe cross-origin action.
      }
      return;
    }

    if (window.self === window.top) {
      const saved = window.sessionStorage.getItem(STORAGE_KEY);
      if (saved === "customer" || saved === "vehicle") {
        window.sessionStorage.removeItem(STORAGE_KEY);
        setToast(saved);
      }
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast || typeof document === "undefined") return null;

  return (
    <div className="fixed right-5 top-20 z-[10080] flex max-w-[430px] items-start gap-3 rounded-xl border border-[#BFE8D5] bg-white px-4 py-3 shadow-[0_14px_35px_rgba(15,23,42,.16)]" role="status">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#E8F8F0] text-[11px] font-bold text-[#147A50]">✓</span>
      <div>
        <p className="text-[10.5px] font-bold text-[#17365D]">{toast === "customer" ? "Customer updated successfully" : "Vehicle updated successfully"}</p>
        <p className="mt-0.5 text-[9.5px] text-[#667085]">Policy details have been refreshed from the linked master record.</p>
      </div>
    </div>
  );
}
