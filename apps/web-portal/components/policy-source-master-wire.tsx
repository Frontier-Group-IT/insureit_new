"use client";

import { useEffect } from "react";

type RmOption = { value: string; label: string };
type SourceOption = {
  type: "POSP" | "MISP" | "SIBL / Partner";
  value: string;
  label: string;
  code: string;
  rmName: string;
  rmCode: string;
};

type Props = {
  rms: RmOption[];
  sources: SourceOption[];
};

type ReactTrackedControl = (HTMLInputElement | HTMLSelectElement) & {
  _valueTracker?: { setValue: (value: string) => void };
};

function controlForLabel(root: ParentNode, labelText: string) {
  const labels = Array.from(root.querySelectorAll("label"));
  const label = labels.find((item) => item.textContent?.trim().toLowerCase().startsWith(labelText.toLowerCase()));
  return label?.parentElement?.querySelector("input,select") as HTMLInputElement | HTMLSelectElement | null;
}

function dispatchValue(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const previousValue = control.value;
  const prototype = control instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(control, value);
  (control as ReactTrackedControl)._valueTracker?.setValue(previousValue);
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
      rm.replaceChildren(new Option("RM not assigned", ""), ...rms.map((item) => new Option(item.label, item.value)));
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

      const optionsForType = () => sources.filter((item) => item.type === type.value);
      const refresh = (clearSelection: boolean) => {
        const options = optionsForType();
        list!.replaceChildren(...options.map((item) => {
          const option = document.createElement("option");
          option.value = item.label;
          option.label = [item.label, item.code, item.rmName].filter(Boolean).join(" · ");
          return option;
        }));
        lead.placeholder = type.value ? `Search ${type.value === "SIBL / Partner" ? "partner" : type.value}` : "Select intermediary type first";
        lead.disabled = !type.value;
        if (clearSelection) {
          dispatchValue(lead, "");
          dispatchValue(code, "");
          dispatchValue(rm, "");
        }
      };

      let syncTimer = 0;
      const syncSelection = () => {
        window.clearTimeout(syncTimer);
        const selectedLabel = lead.value;
        syncTimer = window.setTimeout(() => {
          const selected = optionsForType().find((item) => item.label.trim().toLowerCase() === selectedLabel.trim().toLowerCase());
          dispatchValue(code, selected?.code ?? "");
          dispatchValue(rm, selected?.rmName ?? "");
        }, 0);
      };
      const onTypeChange = () => refresh(true);
      type.addEventListener("change", onTypeChange);
      lead.addEventListener("input", syncSelection);
      lead.addEventListener("change", syncSelection);
      refresh(false);
      syncSelection();

      cleanup = () => {
        window.clearTimeout(syncTimer);
        type.removeEventListener("change", onTypeChange);
        lead.removeEventListener("input", syncSelection);
        lead.removeEventListener("change", syncSelection);
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
