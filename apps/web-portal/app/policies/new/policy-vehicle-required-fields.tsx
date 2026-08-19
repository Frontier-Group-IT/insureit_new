"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const requiredFieldLabels = [
  "MAKE",
  "MODEL",
  "FUEL TYPE",
  "YEAR OF MANUFACTURING",
  "RTO",
  "CAPACITY",
  "CHASSIS NUMBER",
  "ENGINE NUMBER",
] as const;

const displayNames: Record<(typeof requiredFieldLabels)[number], string> = {
  MAKE: "Make",
  MODEL: "Model",
  "FUEL TYPE": "Fuel Type",
  "YEAR OF MANUFACTURING": "Year of Manufacturing",
  RTO: "RTO",
  CAPACITY: "Capacity",
  "CHASSIS NUMBER": "Chassis Number",
  "ENGINE NUMBER": "Engine Number",
};

const policyActionLabels = new Set(["Book Active Policy", "Upload Policy", "Save Policy Changes", "Continue"]);
type RequiredControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type RequiredField = { control: RequiredControl; displayName: string };
type MissingRequiredField = { control: RequiredControl; section: HTMLElement; displayName: string };

function normalizedLabel(value: string | null) {
  return (value ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

function humanizeLabel(value: string | null) {
  const cleaned = (value ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "This field";
  if (/^CLASS\b/i.test(cleaned)) return "Class";
  return cleaned;
}

function displayNameForControl(control: RequiredControl) {
  const helperDisplayName = control.dataset.policyRequiredDisplayName;
  if (helperDisplayName) return helperDisplayName;

  const ariaLabel = control.getAttribute("aria-label");
  if (ariaLabel) return humanizeLabel(ariaLabel);

  if (control.id) {
    const explicitLabel = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(control.id)}"]`);
    if (explicitLabel) return humanizeLabel(explicitLabel.textContent);
  }

  let current: HTMLElement | null = control.parentElement;
  while (current) {
    const label = current.querySelector<HTMLLabelElement>("label");
    if (label) return humanizeLabel(label.textContent);
    if (current.id?.startsWith("policy-section-")) break;
    current = current.parentElement;
  }

  if (control instanceof HTMLSelectElement) {
    const placeholder = control.options[0]?.textContent ?? "";
    const normalized = placeholder.replace(/^Select\s+/i, "").replace(/\s+first$/i, "").trim();
    if (normalized) return humanizeLabel(normalized);
  }

  return "This field";
}

function findRequiredFields(section: HTMLElement) {
  const fields: RequiredField[] = [];
  const labels = Array.from(section.querySelectorAll("label"));

  for (const label of labels) {
    const text = normalizedLabel(label.textContent);
    const requiredLabel = requiredFieldLabels.find((candidate) => text === candidate || text.startsWith(`${candidate} (`));
    if (!requiredLabel) continue;

    const helperMarker = label.querySelector<HTMLElement>("[data-policy-required-marker]");
    const hasNativeVisibleRequiredMarker = Array.from(label.childNodes).some(
      (node) => node !== helperMarker && (node.textContent ?? "").includes("*"),
    );
    if (hasNativeVisibleRequiredMarker) {
      helperMarker?.remove();
    } else if (!helperMarker) {
      const marker = document.createElement("span");
      marker.dataset.policyRequiredMarker = "true";
      marker.className = "text-red-500";
      marker.textContent = "*";
      label.appendChild(marker);
    }

    const container = label.parentElement;
    if (!container) continue;
    const matched = requiredLabel === "RTO"
      ? Array.from(container.querySelectorAll<HTMLInputElement>("input"))
      : Array.from(container.querySelectorAll<RequiredControl>("input, select")).slice(0, 1);

    for (const [index, control] of matched.entries()) {
      if (control.disabled) continue;
      if (!control.required) control.dataset.policyHelperRequired = "true";
      control.required = true;
      control.setAttribute("aria-required", "true");
      if (fields.some((field) => field.control === control)) continue;
      const displayName = requiredLabel === "RTO"
        ? (index === 0 ? "RTO State" : "RTO Name / Code")
        : displayNames[requiredLabel];
      control.dataset.policyRequiredDisplayName = displayName;
      fields.push({ control, displayName });
    }
  }

  return fields;
}

function findFirstMissingRequiredField() {
  for (let sectionNumber = 1; sectionNumber <= 5; sectionNumber += 1) {
    const section = document.getElementById(`policy-section-${sectionNumber}`);
    if (!section) continue;

    const controls = Array.from(
      section.querySelectorAll<RequiredControl>("input[required], select[required], textarea[required]"),
    );

    for (const control of controls) {
      if (control.disabled) continue;
      if (control instanceof HTMLInputElement && (control.type === "hidden" || control.readOnly)) continue;
      if (control instanceof HTMLTextAreaElement && control.readOnly) continue;
      if (String(control.value ?? "").trim()) continue;

      return {
        control,
        section,
        displayName: displayNameForControl(control),
      } satisfies MissingRequiredField;
    }
  }

  return null;
}

function RequiredFieldsDialog({
  message,
  onClose,
  focusAfterClose,
}: {
  message: string;
  onClose: () => void;
  focusAfterClose: RequiredControl | null;
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    okRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
      if (!focusAfterClose?.isConnected || focusAfterClose.disabled) return;
      requestAnimationFrame(() => {
        focusAfterClose.focus({ preventScroll: true });
        focusAfterClose.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    };
  }, [focusAfterClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] grid min-h-[100dvh] w-screen place-items-center bg-[#071D49]/60 p-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        event.preventDefault();
        okRef.current?.focus();
      }}
    >
      <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_24px_70px_rgba(7,29,73,.38)]">
        <div className="px-6 pb-5 pt-6 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#FFF3E8] text-[19px] font-bold text-[#D45B16] ring-6 ring-[#FFF8F2]">!</div>
          <h2 id={titleId} className="mt-4 text-[15px] font-bold text-[#102A4C]">Check details</h2>
          <p id={descriptionId} className="mx-auto mt-2 max-w-sm text-[11px] leading-5 text-[#667085]">{message}</p>
        </div>
        <div className="border-t border-[#E6EBF2] bg-[#F8FAFC] px-5 py-3.5">
          <button ref={okRef} type="button" onClick={onClose} className="h-10 w-full rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white">OK</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function PolicyVehicleRequiredFields() {
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const missingControlRef = useRef<RequiredControl | null>(null);
  const dialogOpenRef = useRef(false);

  useEffect(() => {
    let section: HTMLElement | null = null;
    let fields: RequiredField[] = [];

    const syncRequiredFields = () => {
      section = document.getElementById("policy-section-2");
      if (!section) return;
      fields = findRequiredFields(section);
    };

    syncRequiredFields();
    const observer = new MutationObserver(syncRequiredFields);
    observer.observe(document.body, { childList: true, subtree: true });

    const validateRequiredFieldsSequentially = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!(button instanceof HTMLButtonElement) || !policyActionLabels.has(button.textContent?.trim() ?? "")) return;
      if (dialogOpenRef.current) return;

      syncRequiredFields();
      const missing = findFirstMissingRequiredField();
      if (!missing) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      missing.section.scrollIntoView({ behavior: "smooth", block: "start" });
      missingControlRef.current = missing.control;
      dialogOpenRef.current = true;
      setValidationMessage(`${missing.displayName} is required.`);
    };

    document.addEventListener("click", validateRequiredFieldsSequentially, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", validateRequiredFieldsSequentially, true);
      for (const { control } of fields) {
        if (control.dataset.policyHelperRequired === "true") {
          control.required = false;
          control.removeAttribute("aria-required");
          delete control.dataset.policyHelperRequired;
        }
        delete control.dataset.policyRequiredDisplayName;
        control.setCustomValidity("");
      }
      section?.querySelectorAll("[data-policy-required-marker]").forEach((marker) => marker.remove());
    };
  }, []);

  if (!validationMessage) return null;

  return (
    <RequiredFieldsDialog
      message={validationMessage}
      focusAfterClose={missingControlRef.current}
      onClose={() => {
        dialogOpenRef.current = false;
        setValidationMessage(null);
      }}
    />
  );
}
