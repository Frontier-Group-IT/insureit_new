"use client";

import { useEffect } from "react";

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

const policyActionLabels = new Set(["Book Active Policy", "Upload Policy"]);
type RequiredControl = HTMLInputElement | HTMLSelectElement;

function normalizedLabel(value: string | null) {
  return (value ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

function findRequiredControls(section: HTMLElement) {
  const controls: RequiredControl[] = [];
  const labels = Array.from(section.querySelectorAll("label"));

  for (const label of labels) {
    const text = normalizedLabel(label.textContent);
    const requiredLabel = requiredFieldLabels.find((candidate) => text === candidate || text.startsWith(`${candidate} (`));
    if (!requiredLabel) continue;

    if (!label.querySelector("[data-policy-required-marker]")) {
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

    for (const control of matched) {
      if (control.disabled) continue;
      control.required = true;
      control.setAttribute("aria-required", "true");
      if (!controls.includes(control)) controls.push(control);
    }
  }

  return controls;
}

export function PolicyVehicleRequiredFields() {
  useEffect(() => {
    let section: HTMLElement | null = null;
    let controls: RequiredControl[] = [];

    const syncRequiredFields = () => {
      section = document.getElementById("policy-section-2");
      if (!section) return;
      controls = findRequiredControls(section);
    };

    syncRequiredFields();
    const observer = new MutationObserver(syncRequiredFields);
    observer.observe(document.body, { childList: true, subtree: true });

    const validateRequiredVehicleFields = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || !policyActionLabels.has(button.textContent?.trim() ?? "")) return;

      syncRequiredFields();
      const missing = controls.find((control) => !String(control.value ?? "").trim());
      if (!missing) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
      missing.focus();
      missing.setCustomValidity("This vehicle detail is required before continuing.");
      missing.reportValidity();
      window.setTimeout(() => missing.setCustomValidity(""), 0);
    };

    document.addEventListener("click", validateRequiredVehicleFields, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", validateRequiredVehicleFields, true);
      for (const control of controls) {
        control.required = false;
        control.removeAttribute("aria-required");
        control.setCustomValidity("");
      }
      section?.querySelectorAll("[data-policy-required-marker]").forEach((marker) => marker.remove());
    };
  }, []);

  return null;
}
