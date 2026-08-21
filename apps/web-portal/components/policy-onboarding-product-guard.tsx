"use client";

import { useEffect } from "react";

const SAOD_BLOCKED_CLASSES = new Set(["GCV", "PCV", "CPM", "MISD"]);

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

export function PolicyOnboardingProductGuard() {
  useEffect(() => {
    let lastClass = "";
    let lastProduct = "";

    const sync = () => {
      const classSelect = fieldControl("Class") as HTMLSelectElement | null;
      const productSelect = fieldControl("Policy product") as HTMLSelectElement | null;
      const tpInput = fieldControl("TP premium") as HTMLInputElement | null;
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
    };

    const onChange = () => requestAnimationFrame(sync);
    document.addEventListener("change", onChange, true);
    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    const timer = window.setInterval(() => {
      const classSelect = fieldControl("Class") as HTMLSelectElement | null;
      const productSelect = fieldControl("Policy product") as HTMLSelectElement | null;
      const vehicleClass = classSelect?.value.trim().toUpperCase() ?? "";
      const product = productSelect?.value.trim().toUpperCase() ?? "";
      if (vehicleClass !== lastClass || product !== lastProduct) sync();
    }, 250);

    return () => {
      document.removeEventListener("change", onChange, true);
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
