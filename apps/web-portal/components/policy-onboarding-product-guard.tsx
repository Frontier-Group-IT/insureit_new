"use client";

import { useEffect } from "react";
import type { LifeHealthCustomerOption, LifeHealthSourceOption } from "@/components/life-health-policy-form";

const SAOD_BLOCKED_CLASSES = new Set(["GCV", "PCV", "CPM", "MISD"]);
type InsurerOption = { label: string; value: string; segment?: "general" | "life" | "health" };
type Props = { insurers: InsurerOption[]; customers: LifeHealthCustomerOption[]; sources: LifeHealthSourceOption[] };

function allowedInsurerSegments(policyType: string) {
  if (policyType === "Motor" || policyType === "Non-Motor" || policyType === "Non Motor") return new Set(["general"]);
  if (policyType === "Life" || policyType === "Health") return new Set(["life", "health"]);
  return null;
}

function fieldControl(labelText: string) {
  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((item) => item.textContent?.trim().toLowerCase().startsWith(labelText.toLowerCase()));
  const container = label?.parentElement;
  return container?.querySelector("select, input") as HTMLSelectElement | HTMLInputElement | null;
}

function syncInsurerOptions(policyType: string, insurers: InsurerOption[]) {
  const allowed = allowedInsurerSegments(policyType);
  if (!allowed) return;
  const insurerSelect = fieldControl("Insurance company") as HTMLSelectElement | null;
  if (!insurerSelect) return;
  const segmentById = new Map(insurers.map((item) => [item.value, item.segment]));
  for (const option of Array.from(insurerSelect.options)) {
    if (!option.value) continue;
    const valid = allowed.has(segmentById.get(option.value) ?? "");
    option.hidden = !valid;
    option.disabled = !valid;
  }
  if (insurerSelect.value && !allowed.has(segmentById.get(insurerSelect.value) ?? "")) {
    insurerSelect.value = "";
    insurerSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function syncSourcingDateProxy() {
  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((item) => item.textContent?.trim().toLowerCase().startsWith("policy issuance date"));
  const container = label?.parentElement;
  const actualDate = container?.querySelector('input[type="date"]') as HTMLInputElement | null;
  if (!container || !actualDate) return;
  let proxy = container.querySelector('input[data-life-health-source-date="true"]') as HTMLInputElement | null;
  if (!proxy) { proxy = document.createElement("input"); proxy.type = "hidden"; proxy.dataset.lifeHealthSourceDate = "true"; container.appendChild(proxy); }
  proxy.value = actualDate.value;
}

function setReactValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export function PolicyOnboardingProductGuard({ insurers }: Props) {
  useEffect(() => {
    let lastClass = "", lastProduct = "", lastPolicyType = "";
    const sync = () => {
      const policyType = (fieldControl("Policy type") as HTMLSelectElement | null)?.value.trim() ?? "";
      syncSourcingDateProxy();
      syncInsurerOptions(policyType, insurers);
      lastPolicyType = policyType;
      if (policyType !== "Motor") return;

      const classSelect = fieldControl("Class") as HTMLSelectElement | null;
      const productSelect = fieldControl("Policy product") as HTMLSelectElement | null;
      const idvInput = fieldControl("IDV") as HTMLInputElement | null;
      const odInput = fieldControl("OD premium") as HTMLInputElement | null;
      const tpInput = fieldControl("TP premium") as HTMLInputElement | null;
      if (!classSelect || !productSelect || !idvInput || !odInput) return;
      const vehicleClass = classSelect.value.trim().toUpperCase(), product = productSelect.value.trim().toUpperCase();
      const saodOption = Array.from(productSelect.options).find((option) => option.value.trim().toUpperCase() === "SAOD");
      if (saodOption) { const blocked = SAOD_BLOCKED_CLASSES.has(vehicleClass); saodOption.disabled = blocked; saodOption.hidden = blocked; if (blocked && product === "SAOD") { productSelect.value = ""; productSelect.dispatchEvent(new Event("change", { bubbles: true })); } }
      const thirdParty = product === "THIRD PARTY";
      idvInput.disabled = thirdParty; idvInput.setAttribute("aria-disabled", String(thirdParty));
      odInput.disabled = thirdParty; odInput.setAttribute("aria-disabled", String(thirdParty));
      if (thirdParty && idvInput.value !== "0") setReactValue(idvInput, "0");
      if (thirdParty && odInput.value !== "0") setReactValue(odInput, "0");
      if (tpInput) { const saod = product === "SAOD" && !SAOD_BLOCKED_CLASSES.has(vehicleClass); tpInput.disabled = saod; tpInput.setAttribute("aria-disabled", String(saod)); if (saod && tpInput.value !== "0") setReactValue(tpInput, "0"); }
      lastClass = vehicleClass; lastProduct = product;
    };
    const onChange = () => requestAnimationFrame(sync);
    document.addEventListener("change", onChange, true);
    const observer = new MutationObserver(() => requestAnimationFrame(sync)); observer.observe(document.body, { childList: true, subtree: true }); sync();
    const timer = window.setInterval(() => {
      const policyType = (fieldControl("Policy type") as HTMLSelectElement | null)?.value.trim() ?? "";
      const vehicleClass = (fieldControl("Class") as HTMLSelectElement | null)?.value.trim().toUpperCase() ?? "";
      const product = (fieldControl("Policy product") as HTMLSelectElement | null)?.value.trim().toUpperCase() ?? "";
      if (policyType !== lastPolicyType || vehicleClass !== lastClass || product !== lastProduct) sync(); else { syncSourcingDateProxy(); syncInsurerOptions(policyType, insurers); }
    }, 250);
    return () => { document.removeEventListener("change", onChange, true); observer.disconnect(); window.clearInterval(timer); };
  }, [insurers]);

  return null;
}
