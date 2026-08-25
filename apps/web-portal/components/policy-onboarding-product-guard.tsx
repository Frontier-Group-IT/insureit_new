"use client";

import { useEffect } from "react";

const SAOD_BLOCKED_CLASSES = new Set(["GCV", "PCV", "CPM", "MISD"]);
const POLICY_TYPE_OPTIONS = ["Motor", "Life", "Non Motor", "Health"] as const;

function fieldControl(labelText: string) {
  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((item) => item.textContent?.trim().toLowerCase().startsWith(labelText.toLowerCase()));
  const container = label?.parentElement;
  if (!container) return null;
  return container.querySelector("select, input") as HTMLSelectElement | HTMLInputElement | null;
}

function setReactValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function policyTypeSignature(select: HTMLSelectElement) {
  return Array.from(select.options)
    .map((option) => `${option.value}:${option.hidden ? "1" : "0"}:${option.disabled ? "1" : "0"}`)
    .join("|");
}

function syncPolicyTypeOptions(select: HTMLSelectElement) {
  const currentValue = select.value.trim();
  const selectableOptions = Array.from(select.options).filter((option) => option.value.trim() !== "");
  if (selectableOptions.length < POLICY_TYPE_OPTIONS.length) return;

  POLICY_TYPE_OPTIONS.forEach((value, index) => {
    const option = selectableOptions[index];
    option.value = value;
    option.textContent = value;
    option.hidden = false;
    option.disabled = false;
  });

  selectableOptions.slice(POLICY_TYPE_OPTIONS.length).forEach((option) => {
    option.hidden = true;
    option.disabled = true;
  });

  const normalizedCurrent = POLICY_TYPE_OPTIONS.find((value) => value.toLowerCase() === currentValue.toLowerCase());
  const nextValue = normalizedCurrent ?? "Motor";
  if (select.value !== nextValue) {
    select.value = nextValue;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

export function PolicyOnboardingProductGuard() {
  useEffect(() => {
    let lastClass = "";
    let lastProduct = "";
    let lastPolicyTypes = "";

    const sync = () => {
      const policyTypeSelect = fieldControl("Policy type") as HTMLSelectElement | null;
      const classSelect = fieldControl("Class") as HTMLSelectElement | null;
      const productSelect = fieldControl("Policy product") as HTMLSelectElement | null;
      const tpInput = fieldControl("TP premium") as HTMLInputElement | null;
      if (!policyTypeSelect) return;

      syncPolicyTypeOptions(policyTypeSelect);

      if (policyTypeSelect.value === "Non Motor" && window.location.pathname === "/policies/new") {
        window.location.assign("/policies/new/non-motor");
        return;
      }

      if (!classSelect || !productSelect || !tpInput) return;

      const vehicleClass = classSelect.value.trim().toUpperCase();
      const product = productSelect.value.trim().toUpperCase();
      const saodOption = Array.from(productSelect.options).find((option) => option.value.trim().toUpperCase() === "SAOD");

      if (saodOption) {
        const blocked = SAOD_BLOCKED_CLASSES.has(vehicleClass);
        saodOption.disabled = blocked;
        saodOption.hidden = blocked;
        if (blocked && product === "SAOD") {
          productSelect.value = "";
          productSelect.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }

      const isSaod = product === "SAOD" && !SAOD_BLOCKED_CLASSES.has(vehicleClass);
      tpInput.disabled = isSaod;
      tpInput.setAttribute("aria-disabled", isSaod ? "true" : "false");
      if (isSaod && tpInput.value !== "0") setReactValue(tpInput, "0");

      lastClass = vehicleClass;
      lastProduct = product;
      lastPolicyTypes = policyTypeSignature(policyTypeSelect);
    };

    const onChange = () => requestAnimationFrame(sync);
    document.addEventListener("change", onChange, true);
    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    const timer = window.setInterval(() => {
      const policyTypeSelect = fieldControl("Policy type") as HTMLSelectElement | null;
      const classSelect = fieldControl("Class") as HTMLSelectElement | null;
      const productSelect = fieldControl("Policy product") as HTMLSelectElement | null;
      const vehicleClass = classSelect?.value.trim().toUpperCase() ?? "";
      const product = productSelect?.value.trim().toUpperCase() ?? "";
      const policyTypes = policyTypeSelect ? policyTypeSignature(policyTypeSelect) : "";
      if (vehicleClass !== lastClass || product !== lastProduct || policyTypes !== lastPolicyTypes) sync();
    }, 250);

    return () => {
      document.removeEventListener("change", onChange, true);
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
