"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LifeHealthPolicyForm, type LifeHealthCustomerOption, type LifeHealthSourceOption } from "@/components/life-health-policy-form";

const SAOD_BLOCKED_CLASSES = new Set(["GCV", "PCV", "CPM", "MISD"]);
type Props = { insurers: Array<{ label: string; value: string }>; customers: LifeHealthCustomerOption[]; sources: LifeHealthSourceOption[] };
type LifeHealthMount = { formTarget: HTMLElement; summaryTarget: HTMLElement };

function fieldControl(labelText: string) {
  const labels = Array.from(document.querySelectorAll("label"));
  const label = labels.find((item) => item.textContent?.trim().toLowerCase().startsWith(labelText.toLowerCase()));
  const container = label?.parentElement;
  return container?.querySelector("select, input") as HTMLSelectElement | HTMLInputElement | null;
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

function restoreLifeHealthMounts() {
  document.querySelectorAll<HTMLElement>("[data-life-health-layout='true']").forEach((layout) => {
    const source = layout.querySelector<HTMLElement>("[data-life-health-source='true']");
    const notice = layout.nextElementSibling as HTMLElement | null;
    const parent = layout.parentElement;
    if (source && parent) { delete source.dataset.lifeHealthSource; parent.insertBefore(source, layout); }
    layout.remove();
    if (notice?.dataset.lifeHealthNoticeHidden === "true") { notice.style.display = ""; delete notice.dataset.lifeHealthNoticeHidden; }
  });
  document.querySelectorAll<HTMLElement>("[data-life-health-notice-hidden='true']").forEach((notice) => { notice.style.display = ""; delete notice.dataset.lifeHealthNoticeHidden; });
}

function ensureLifeHealthMount(policyType: "Life" | "Health"): LifeHealthMount | null {
  const existing = document.querySelector<HTMLElement>("[data-life-health-layout='true']");
  if (existing) {
    const formTarget = existing.querySelector<HTMLElement>("[data-life-health-portal='true']");
    const summaryTarget = existing.querySelector<HTMLElement>("[data-life-health-summary='true']");
    if (formTarget && summaryTarget) return { formTarget, summaryTarget };
  }
  const heading = Array.from(document.querySelectorAll("h2")).find((item) => item.textContent?.trim() === `${policyType} onboarding`);
  const notice = heading?.closest("section") as HTMLElement | null;
  const parent = notice?.parentElement;
  const source = notice?.previousElementSibling as HTMLElement | null;
  if (!notice || !parent || !source) return null;

  notice.dataset.lifeHealthNoticeHidden = "true";
  notice.style.display = "none";
  const layout = document.createElement("div");
  layout.dataset.lifeHealthLayout = "true";
  layout.className = "grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]";
  const left = document.createElement("div"); left.className = "space-y-4";
  const formTarget = document.createElement("div"); formTarget.dataset.lifeHealthPortal = "true";
  const summaryTarget = document.createElement("div"); summaryTarget.dataset.lifeHealthSummary = "true"; summaryTarget.className = "self-start xl:sticky xl:top-[150px]";
  source.dataset.lifeHealthSource = "true";
  parent.insertBefore(layout, source);
  left.appendChild(source); left.appendChild(formTarget); layout.appendChild(left); layout.appendChild(summaryTarget);
  return { formTarget, summaryTarget };
}

export function PolicyOnboardingProductGuard({ insurers, customers, sources }: Props) {
  const [lifeHealthType, setLifeHealthType] = useState<"Life" | "Health" | null>(null);
  const [mount, setMount] = useState<LifeHealthMount | null>(null);

  useEffect(() => {
    let lastClass = "", lastProduct = "", lastPolicyType = "";
    const sync = () => {
      const policyType = (fieldControl("Policy type") as HTMLSelectElement | null)?.value.trim() ?? "";
      syncSourcingDateProxy();
      if (policyType === "Life" || policyType === "Health") {
        const next = ensureLifeHealthMount(policyType);
        setLifeHealthType((current) => current === policyType ? current : policyType);
        if (next) setMount((current) => current?.formTarget === next.formTarget ? current : next);
      } else {
        if (lastPolicyType === "Life" || lastPolicyType === "Health" || document.querySelector("[data-life-health-layout='true']")) restoreLifeHealthMounts();
        setLifeHealthType(null); setMount(null);
      }
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
      if (policyType !== lastPolicyType || vehicleClass !== lastClass || product !== lastProduct) sync(); else syncSourcingDateProxy();
    }, 250);
    return () => { document.removeEventListener("change", onChange, true); observer.disconnect(); window.clearInterval(timer); restoreLifeHealthMounts(); };
  }, [sources]);

  return mount && lifeHealthType ? createPortal(<LifeHealthPolicyForm policyType={lifeHealthType} insurers={insurers} customers={customers} sources={sources} summaryTarget={mount.summaryTarget} />, mount.formTarget) : null;
}
