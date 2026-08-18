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

type RequiredControl = HTMLInputElement | HTMLSelectElement;

function normalizedLabel(value: string | null) {
  return (value ?? "").replace(/\*/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

export function PolicyVehicleRequiredFields() {
  useEffect(() => {
    const section = document.getElementById("policy-section-2");
    if (!section) return;

    const touchedControls: RequiredControl[] = [];
    const addedMarkers: HTMLSpanElement[] = [];

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
        addedMarkers.push(marker);
      }

      const container = label.parentElement;
      if (!container) continue;
      const controls = requiredLabel === "RTO"
        ? Array.from(container.querySelectorAll<HTMLInputElement>("input"))
        : Array.from(container.querySelectorAll<RequiredControl>("input, select")).slice(0, 1);

      for (const control of controls) {
        control.required = true;
        control.setAttribute("aria-required", "true");
        touchedControls.push(control);
      }
    }

    const validateRequiredVehicleFields = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button");
      if (!button || button.textContent?.trim() !== "Book Active Policy") return;

      const missing = touchedControls.find((control) => !control.disabled && !String(control.value ?? "").trim());
      if (!missing) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      missing.focus();
      missing.setCustomValidity("This vehicle detail is required before booking the policy.");
      missing.reportValidity();
      window.setTimeout(() => missing.setCustomValidity(""), 0);
    };

    document.addEventListener("click", validateRequiredVehicleFields, true);

    return () => {
      document.removeEventListener("click", validateRequiredVehicleFields, true);
      for (const control of touchedControls) {
        control.required = false;
        control.removeAttribute("aria-required");
        control.setCustomValidity("");
      }
      for (const marker of addedMarkers) marker.remove();
    };
  }, []);

  return null;
}
