"use client";

import { useEffect } from "react";

type RmOption = { value: string; label: string };
type SourceOption = { type: "POSP" | "MISP" | "SIBL / Partner"; value: string; label: string; code: string };

type Props = {
  rms: RmOption[];
  sources: SourceOption[];
};

function controlForLabel(root: ParentNode, labelText: string) {
  const labels = Array.from(root.querySelectorAll("label"));
  const label = labels.find((item) => item.textContent?.trim().toLowerCase().startsWith(labelText.toLowerCase()));
  return label?.parentElement?.querySelector("input,select") as HTMLInputElement | HTMLSelectElement | null;
}

function dispatchValue(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
  control.dispatchEvent(new Event("change", { bubbles: true }));
}

export function PolicySourceMasterWire({ rms, sources }: Props) {
  useEffect(() => {
    let cleanup = () => {};

    const wire = () => {
      cleanup();
      const root = document;
      const rm = controlForLabel(root, "RM name");
      const type = controlForLabel(root, "Intermediary type");
      const lead = controlForLabel(root, "Lead source");
      const code = controlForLabel(root, "Intermediary code");
      if (!(rm instanceof HTMLSelectElement) || !(type instanceof HTMLSelectElement) || !(lead instanceof HTMLInputElement) || !(code instanceof HTMLInputElement)) return false;

      const currentRm = rm.value;
      rm.replaceChildren(new Option("Select RM", ""), ...rms.map((item) => new Option(item.label, item.value)));
      if (rms.some((item) => item.value === currentRm)) rm.value = currentRm;

      const listId = "policy-lead-source-master-options";
      let list = document.getElementById(listId) as HTMLDataListElement | null;
      if (!list) {
        list = document.createElement("datalist");
        list.id = listId;
        document.body.appendChild(list);
      }
      lead.setAttribute("list", listId);
      lead.setAttribute("autocomplete", "off");
      code.readOnly = true;
      code.setAttribute("aria-readonly", "true");
      code.classList.add("cursor-not-allowed", "bg-[#F8FAFC]");

      const optionsForType = () => sources.filter((item) => item.type === type.value);
      const refresh = (clearSelection: boolean) => {
        const options = optionsForType();
        list!.replaceChildren(...options.map((item) => {
          const option = document.createElement("option");
          option.value = item.label;
          option.label = item.code ? `${item.label} · ${item.code}` : item.label;
          return option;
        }));
        lead.placeholder = type.value ? `Search ${type.value === "SIBL / Partner" ? "partner" : type.value}` : "Select intermediary type first";
        code.placeholder = type.value === "POSP" ? "POSP code" : type.value === "MISP" ? "MISP code" : type.value === "SIBL / Partner" ? "Partner ID" : "Auto-filled from lead source";
        lead.disabled = !type.value;
        if (clearSelection) {
          dispatchValue(lead, "");
          dispatchValue(code, "");
        }
      };

      const syncCode = () => {
        const selected = optionsForType().find((item) => item.label.trim().toLowerCase() === lead.value.trim().toLowerCase());
        dispatchValue(code, selected?.code ?? "");
      };
      const onTypeChange = () => refresh(true);
      type.addEventListener("change", onTypeChange);
      lead.addEventListener("input", syncCode);
      lead.addEventListener("change", syncCode);
      refresh(false);
      syncCode();

      cleanup = () => {
        type.removeEventListener("change", onTypeChange);
        lead.removeEventListener("input", syncCode);
        lead.removeEventListener("change", syncCode);
      };
      return true;
    };

    if (wire()) return cleanup;
    const observer = new MutationObserver(() => { if (wire()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); cleanup(); };
  }, [rms, sources]);

  return null;
}
