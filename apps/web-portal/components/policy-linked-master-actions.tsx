"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type EditorKind = "customer" | "vehicle";

type Props = {
  customerId: string;
  vehicleId: string;
  canEditCustomer: boolean;
  canEditVehicle: boolean;
};

type VehicleIdentity = {
  vehicleNo: string;
  chassisNo: string;
  engineNo: string;
};

function fieldValue(document: Document, name: string) {
  const field = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  return field?.value.trim().toUpperCase() ?? "";
}

export function PolicyLinkedMasterActions({ customerId, vehicleId, canEditCustomer, canEditVehicle }: Props) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const dirtyRef = useRef(false);
  const vehicleIdentityRef = useRef<VehicleIdentity | null>(null);
  const pendingVehicleFormRef = useRef<HTMLFormElement | null>(null);
  const vehicleIdentifierConfirmedRef = useRef(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [editor, setEditor] = useState<EditorKind | null>(null);
  const [closeWarning, setCloseWarning] = useState(false);
  const [identifierWarning, setIdentifierWarning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    const findHost = () => {
      const section = document.getElementById("policy-section-2");
      const header = section?.firstElementChild;
      const host = header?.lastElementChild;
      if (host instanceof HTMLElement) {
        setPortalHost(host);
        return;
      }
      frame = window.requestAnimationFrame(findHost);
    };
    findHost();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [editor]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function openEditor(kind: EditorKind) {
    dirtyRef.current = false;
    vehicleIdentityRef.current = null;
    pendingVehicleFormRef.current = null;
    vehicleIdentifierConfirmedRef.current = false;
    setCloseWarning(false);
    setIdentifierWarning(false);
    setEditor(kind);
  }

  function requestClose() {
    if (dirtyRef.current) {
      setCloseWarning(true);
      return;
    }
    closeEditor();
  }

  function closeEditor() {
    dirtyRef.current = false;
    pendingVehicleFormRef.current = null;
    vehicleIdentifierConfirmedRef.current = false;
    setCloseWarning(false);
    setIdentifierWarning(false);
    setEditor(null);
  }

  function finishSuccess(kind: EditorKind) {
    dirtyRef.current = false;
    setEditor(null);
    setCloseWarning(false);
    setIdentifierWarning(false);
    setToast(kind === "customer" ? "Customer updated successfully. Policy details refreshed." : "Vehicle updated successfully. Policy details refreshed.");
    router.refresh();
  }

  function onFrameLoad() {
    if (!editor) return;
    const frame = iframeRef.current;
    const frameWindow = frame?.contentWindow;
    const frameDocument = frame?.contentDocument;
    if (!frameWindow || !frameDocument) return;

    let url: URL;
    try {
      url = new URL(frameWindow.location.href);
    } catch {
      return;
    }

    const success = url.searchParams.get("success");
    if (editor === "customer" && success && (url.pathname === "/customers" || url.pathname === `/customers/${customerId}/edit`)) {
      finishSuccess("customer");
      return;
    }
    if (editor === "vehicle" && url.pathname === "/vehicles" && success === "vehicle_updated") {
      finishSuccess("vehicle");
      return;
    }

    const expectedPath = editor === "customer" ? `/customers/${customerId}/edit` : `/vehicles/${vehicleId}/edit`;
    if (url.pathname === expectedPath && url.searchParams.get("embedded") !== "1") {
      url.searchParams.set("embedded", "1");
      if (editor === "vehicle") url.searchParams.set("lock_owner", "1");
      frame.src = `${url.pathname}${url.search}`;
      return;
    }

    dirtyRef.current = false;
    const markDirty = () => { dirtyRef.current = true; };
    frameDocument.addEventListener("input", markDirty, true);
    frameDocument.addEventListener("change", markDirty, true);

    const closeLinks = Array.from(frameDocument.querySelectorAll<HTMLAnchorElement>("a[href]"));
    for (const link of closeLinks) {
      const href = link.getAttribute("href");
      if (href === "/customers" || href === "/vehicles") {
        link.addEventListener("click", (event) => {
          event.preventDefault();
          requestClose();
        });
      }
    }

    if (editor !== "vehicle") return;

    const customerSelect = frameDocument.querySelector<HTMLSelectElement>('select[name="customer_id"]');
    if (customerSelect && !frameDocument.querySelector('[data-policy-locked-customer="true"]')) {
      const hidden = frameDocument.createElement("input");
      hidden.type = "hidden";
      hidden.name = "customer_id";
      hidden.value = customerSelect.value;
      hidden.dataset.policyLockedCustomer = "true";
      customerSelect.insertAdjacentElement("afterend", hidden);
      customerSelect.disabled = true;
      customerSelect.setAttribute("aria-disabled", "true");
      customerSelect.title = "Vehicle ownership is locked while editing from a policy.";
    }

    vehicleIdentityRef.current = {
      vehicleNo: fieldValue(frameDocument, "vehicle_no"),
      chassisNo: fieldValue(frameDocument, "chassis_no"),
      engineNo: fieldValue(frameDocument, "engine_no"),
    };

    const form = frameDocument.querySelector<HTMLFormElement>("form");
    form?.addEventListener("submit", (event) => {
      if (vehicleIdentifierConfirmedRef.current) return;
      const original = vehicleIdentityRef.current;
      if (!original) return;
      const current = {
        vehicleNo: fieldValue(frameDocument, "vehicle_no"),
        chassisNo: fieldValue(frameDocument, "chassis_no"),
        engineNo: fieldValue(frameDocument, "engine_no"),
      };
      const changed = current.vehicleNo !== original.vehicleNo || current.chassisNo !== original.chassisNo || current.engineNo !== original.engineNo;
      if (!changed) return;
      event.preventDefault();
      event.stopPropagation();
      pendingVehicleFormRef.current = form;
      setIdentifierWarning(true);
    }, true);
  }

  function confirmVehicleIdentityUpdate() {
    const form = pendingVehicleFormRef.current;
    if (!form) {
      setIdentifierWarning(false);
      return;
    }
    vehicleIdentifierConfirmedRef.current = true;
    setIdentifierWarning(false);
    form.requestSubmit();
  }

  const actions = portalHost && (canEditCustomer || canEditVehicle) ? createPortal(
    <>
      {canEditCustomer ? <button type="button" onClick={() => openEditor("customer")} className="rounded-lg border border-[#B8C7DA] bg-white px-3 py-1.5 text-[9px] font-bold text-[#17365D] shadow-sm transition hover:border-[#7F9CBE] hover:bg-[#F4F8FC]">Edit Customer</button> : null}
      {canEditVehicle ? <button type="button" onClick={() => openEditor("vehicle")} className="rounded-lg border border-[#17365D] bg-[#17365D] px-3 py-1.5 text-[9px] font-bold text-white shadow-sm transition hover:bg-[#214A7A]">Edit Vehicle</button> : null}
    </>,
    portalHost,
  ) : null;

  const editorUrl = editor === "customer"
    ? `/customers/${customerId}/edit?embedded=1`
    : editor === "vehicle"
      ? `/vehicles/${vehicleId}/edit?embedded=1&lock_owner=1`
      : "";

  return <>
    {actions}
    {editor && typeof document !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-[10020] flex min-h-[100dvh] w-screen items-center justify-center bg-[#071D49]/65 p-2 backdrop-blur-[2px] sm:p-4" role="dialog" aria-modal="true" aria-label={editor === "customer" ? "Edit customer" : "Edit vehicle"}>
        <div className="flex h-[92dvh] w-[96vw] max-w-[1500px] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_28px_90px_rgba(7,29,73,.42)]">
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#DCE4EE] bg-[linear-gradient(135deg,#F8FAFD,#EEF4FB)] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-[14px] font-bold text-[#102A4C]">{editor === "customer" ? "Edit Customer" : "Edit Vehicle"}</h2>
              <p className="mt-0.5 text-[9px] text-[#667085]">Updates are saved to the linked master record and reflected across linked policy records.</p>
            </div>
            <button type="button" onClick={requestClose} aria-label="Close editor" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#CBD5E1] bg-white text-[19px] leading-none text-[#475467] transition hover:bg-[#F8FAFC]">×</button>
          </div>
          <iframe ref={iframeRef} src={editorUrl} onLoad={onFrameLoad} title={editor === "customer" ? "Customer editor" : "Vehicle editor"} className="min-h-0 flex-1 w-full border-0 bg-[#F6F8FB]" />
        </div>
      </div>,
      document.body,
    ) : null}

    {closeWarning && typeof document !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-[10040] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/55 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true">
        <div className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_70px_rgba(7,29,73,.38)]">
          <div className="px-6 pb-5 pt-6 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#FFF4E5] text-[20px] font-bold text-[#B76E00]">!</div>
            <h3 className="mt-4 text-[15px] font-bold text-[#102A4C]">Discard unsaved changes?</h3>
            <p className="mt-2 text-[10.5px] leading-5 text-[#667085]">You changed information in this editor. Closing now will discard changes that have not been saved.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#E6EBF2] bg-[#F8FAFC] px-5 py-3.5">
            <button type="button" onClick={() => setCloseWarning(false)} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#475467]">Continue Editing</button>
            <button type="button" onClick={closeEditor} className="rounded-xl bg-[#B42318] px-4 py-2.5 text-[10px] font-bold text-white">Discard & Close</button>
          </div>
        </div>
      </div>,
      document.body,
    ) : null}

    {identifierWarning && typeof document !== "undefined" ? createPortal(
      <div className="fixed inset-0 z-[10040] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/55 p-4 backdrop-blur-[2px]" role="alertdialog" aria-modal="true">
        <div className="w-full max-w-[470px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_70px_rgba(7,29,73,.38)]">
          <div className="px-6 pb-5 pt-6 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#FFF4E5] text-[20px] font-bold text-[#B76E00]">!</div>
            <h3 className="mt-4 text-[15px] font-bold text-[#102A4C]">Update vehicle identification?</h3>
            <p className="mt-2 text-[10.5px] leading-5 text-[#667085]">Registration, chassis or engine information has changed. The corrected master details will be shown across every policy linked to this vehicle.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#E6EBF2] bg-[#F8FAFC] px-5 py-3.5">
            <button type="button" onClick={() => { pendingVehicleFormRef.current = null; setIdentifierWarning(false); }} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-[10px] font-semibold text-[#475467]">Cancel</button>
            <button type="button" onClick={confirmVehicleIdentityUpdate} className="rounded-xl bg-[#17365D] px-4 py-2.5 text-[10px] font-bold text-white">Update Vehicle</button>
          </div>
        </div>
      </div>,
      document.body,
    ) : null}

    {toast && typeof document !== "undefined" ? createPortal(
      <div className="fixed right-5 top-20 z-[10060] flex max-w-[430px] items-start gap-3 rounded-xl border border-[#BFE8D5] bg-white px-4 py-3 shadow-[0_14px_35px_rgba(15,23,42,.16)]" role="status">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#E8F7EF] text-[11px] font-bold text-[#14845B]">✓</span>
        <div><p className="text-[10.5px] font-bold text-[#17365D]">Changes saved</p><p className="mt-0.5 text-[9px] leading-4 text-[#667085]">{toast}</p></div>
      </div>,
      document.body,
    ) : null}
  </>;
}
