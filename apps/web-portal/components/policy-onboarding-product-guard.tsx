"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  LifeHealthPolicyForm,
  type LifeHealthCustomerOption,
  type LifeHealthSourceOption,
} from "@/components/life-health-policy-form";

const SAOD_BLOCKED_CLASSES = new Set(["GCV", "PCV", "CPM", "MISD"]);

type Props = {
  insurers: Array<{ label: string; value: string }>;
  customers: LifeHealthCustomerOption[];
  sources: LifeHealthSourceOption[];
};

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

function outerSourceCell(control: HTMLSelectElement | HTMLInputElement | null) {
  if (!control) return null;
  const parent = control.parentElement;
  if (!parent) return null;
  return parent.querySelector("label") ? parent.parentElement : parent;
}

function addInlineMeta(cell: HTMLElement | null, key: string, label: string, value: string) {
  if (!cell) return;
  const metaBlocks = Array.from(cell.children).filter((child) => child instanceof HTMLDivElement && child.querySelector("span")) as HTMLDivElement[];
  const meta = metaBlocks.find((item) => item.className.includes("mt-1.5")) ?? metaBlocks[metaBlocks.length - 1];
  const line = meta?.firstElementChild as HTMLElement | null;
  if (!line) return;
  let extra = line.querySelector(`[data-policy-source-extra="${key}"]`) as HTMLElement | null;
  if (!extra) {
    const separator = document.createElement("span");
    separator.dataset.policySourceExtraSeparator = key;
    separator.className = "shrink-0 text-[8.5px] font-semibold text-[#C1CAD6]";
    separator.textContent = "·";
    extra = document.createElement("span");
    extra.dataset.policySourceExtra = key;
    extra.className = "min-w-0 truncate text-[9px] font-semibold tracking-[.005em] text-[#56708D]";
    line.append(separator, extra);
  }
  extra.textContent = `${label} ${value || "—"}`;
}

function syncSourceMeta(sources: LifeHealthSourceOption[]) {
  const leadSource = fieldControl("Lead source") as HTMLSelectElement | null;
  const selected = sources.find((item) => item.value === leadSource?.value);
  const intermediaryType = fieldControl("Intermediary type");
  addInlineMeta(outerSourceCell(intermediaryType), "rm-code", "Code ·", selected?.rmCode || "Select lead source");
  addInlineMeta(outerSourceCell(leadSource), "source-mobile", "Mobile ·", selected?.mobile || "Select lead source");
}

function restoreLifeHealthMounts() {
  document.querySelectorAll<HTMLElement>("[data-life-health-notice-hidden='true']").forEach((notice) => {
    notice.style.display = "";
    delete notice.dataset.lifeHealthNoticeHidden;
  });
  document.querySelectorAll<HTMLElement>("[data-life-health-portal='true']").forEach((target) => target.remove());
}

function ensureLifeHealthMount(policyType: "Life" | "Health") {
  const heading = Array.from(document.querySelectorAll("h2")).find((item) => item.textContent?.trim() === `${policyType} onboarding`);
  const notice = heading?.closest("section") as HTMLElement | null;
  const parent = notice?.parentElement;
  if (!notice || !parent) return null;
  notice.dataset.lifeHealthNoticeHidden = "true";
  notice.style.display = "none";
  let target = parent.querySelector<HTMLElement>("[data-life-health-portal='true']");
  if (!target) {
    target = document.createElement("div");
    target.dataset.lifeHealthPortal = "true";
    target.className = "space-y-4";
    notice.insertAdjacentElement("afterend", target);
  }
  return target;
}

export function PolicyOnboardingProductGuard({ insurers, customers, sources }: Props) {
  const [lifeHealthType, setLifeHealthType] = useState<"Life" | "Health" | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let lastClass = "";
    let lastProduct = "";
    let lastPolicyType = "";

    const sync = () => {
      const policyTypeSelect = fieldControl("Policy type") as HTMLSelectElement | null;
      const policyType = policyTypeSelect?.value.trim() ?? "";
      syncSourceMeta(sources);

      if (policyType === "Life" || policyType === "Health") {
        const target = ensureLifeHealthMount(policyType);
        setLifeHealthType((current) => current === policyType ? current : policyType);
        if (target) setPortalTarget((current) => current === target ? current : target);
      } else {
        if (lastPolicyType === "Life" || lastPolicyType === "Health" || portalTarget) restoreLifeHealthMounts();
        setLifeHealthType(null);
        setPortalTarget(null);
      }
      lastPolicyType = policyType;
      if (policyType !== "Motor") return;

      const classSelect = fieldControl("Class") as HTMLSelectElement | null;
      const productSelect = fieldControl("Policy product") as HTMLSelectElement | null;
      const idvInput = fieldControl("IDV") as HTMLInputElement | null;
      const odInput = fieldControl("OD premium") as HTMLInputElement | null;
      const tpInput = fieldControl("TP premium") as HTMLInputElement | null;
      if (!classSelect || !productSelect || !idvInput || !odInput) return;

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

      const isThirdParty = product === "THIRD PARTY";
      idvInput.disabled = isThirdParty;
      idvInput.setAttribute("aria-disabled", isThirdParty ? "true" : "false");
      odInput.disabled = isThirdParty;
      odInput.setAttribute("aria-disabled", isThirdParty ? "true" : "false");
      if (isThirdParty && idvInput.value !== "0") setReactValue(idvInput, "0");
      if (isThirdParty && odInput.value !== "0") setReactValue(odInput, "0");

      if (tpInput) {
        const isSaod = product === "SAOD" && !SAOD_BLOCKED_CLASSES.has(vehicleClass);
        tpInput.disabled = isSaod;
        tpInput.setAttribute("aria-disabled", isSaod ? "true" : "false");
        if (isSaod && tpInput.value !== "0") setReactValue(tpInput, "0");
      }

      lastClass = vehicleClass;
      lastProduct = product;
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
      const policyType = policyTypeSelect?.value.trim() ?? "";
      const vehicleClass = classSelect?.value.trim().toUpperCase() ?? "";
      const product = productSelect?.value.trim().toUpperCase() ?? "";
      if (policyType !== lastPolicyType || vehicleClass !== lastClass || product !== lastProduct) sync();
      else syncSourceMeta(sources);
    }, 250);

    return () => {
      document.removeEventListener("change", onChange, true);
      observer.disconnect();
      window.clearInterval(timer);
      restoreLifeHealthMounts();
    };
  }, [sources]);

  return portalTarget && lifeHealthType
    ? createPortal(<LifeHealthPolicyForm policyType={lifeHealthType} insurers={insurers} customers={customers} sources={sources} />, portalTarget)
    : null;
}
