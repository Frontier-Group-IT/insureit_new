"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { LifeHealthPolicyForm, type LifeHealthCustomerOption, type LifeHealthSourceOption } from "@/components/life-health-policy-form";

const SAOD_BLOCKED_CLASSES = new Set(["GCV", "PCV", "CPM", "MISD"]);
const LIFE_HEALTH_SECTIONS = ["Source", "Customer / Proposer", "Policy Product & Case", "Premium & Payment"];
type Props = { insurers: Array<{ label: string; value: string }>; customers: LifeHealthCustomerOption[]; sources: LifeHealthSourceOption[] };
type LifeHealthMount = { formTarget: HTMLElement; summaryTarget: HTMLElement; footerTarget: HTMLElement; navTarget: HTMLElement };

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

function lifeHealthSection(index: number) {
  return document.getElementById(`policy-section-${index + 1}`) ?? document.getElementById(`policy-section-${String(index + 1).padStart(2, "0")}`);
}

function LifeHealthSectionNav() {
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const elements = LIFE_HEALTH_SECTIONS.map((_, index) => lifeHealthSection(index)).filter((item): item is HTMLElement => Boolean(item));
    if (!elements.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (!visible[0]) return;
      const index = elements.indexOf(visible[0].target as HTMLElement);
      if (index >= 0) setActiveSection(index);
    }, { rootMargin: "-145px 0px -58% 0px", threshold: [0, .05, .2] });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  function goToSection(index: number) {
    setActiveSection(index);
    lifeHealthSection(index)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <nav aria-label="Life and Health policy sections" className="sticky top-[72px] z-50 mb-3 flex min-h-[36px] items-stretch gap-4 overflow-x-auto rounded-b-xl border border-t-0 border-[#D9E2F0] bg-white/96 px-4 shadow-[0_5px_14px_rgba(15,23,42,.06)] backdrop-blur">
    {LIFE_HEALTH_SECTIONS.map((section, index) => {
      const active = activeSection === index;
      return <button key={section} type="button" onClick={() => goToSection(index)} aria-current={active ? "step" : undefined} className={`group relative flex min-w-fit items-center gap-1.5 border-b-2 px-0.5 py-2 text-[9px] font-semibold transition ${active ? "border-[#4F46E5] text-[#3346B8]" : "border-transparent text-[#667085] hover:border-[#CBD5E1] hover:text-[#344054]"}`}>
        <span className={`text-[8px] font-bold tabular-nums ${active ? "text-[#4F46E5]" : "text-[#98A2B3]"}`}>{String(index + 1).padStart(2, "0")}</span>
        <span>{section}</span>
      </button>;
    })}
  </nav>;
}

function restoreLifeHealthMounts() {
  document.querySelectorAll<HTMLElement>("[data-life-health-layout='true']").forEach((layout) => {
    const source = layout.querySelector<HTMLElement>("[data-life-health-source='true']");
    const parent = layout.parentElement;
    const footer = parent?.querySelector<HTMLElement>("[data-life-health-footer='true']") ?? null;
    const nav = parent?.querySelector<HTMLElement>("[data-life-health-nav='true']") ?? null;
    if (source && parent) { delete source.dataset.lifeHealthSource; parent.insertBefore(source, layout); }
    footer?.remove();
    nav?.remove();
    layout.remove();
  });
  document.querySelectorAll<HTMLElement>("[data-life-health-notice-hidden='true']").forEach((notice) => { notice.style.display = ""; delete notice.dataset.lifeHealthNoticeHidden; });
}

function ensureLifeHealthMount(policyType: "Life" | "Health"): LifeHealthMount | null {
  const existing = document.querySelector<HTMLElement>("[data-life-health-layout='true']");
  if (existing) {
    const formTarget = existing.querySelector<HTMLElement>("[data-life-health-portal='true']");
    const summaryTarget = existing.querySelector<HTMLElement>("[data-life-health-summary='true']");
    const footerTarget = existing.parentElement?.querySelector<HTMLElement>("[data-life-health-footer='true']") ?? null;
    const navTarget = existing.parentElement?.querySelector<HTMLElement>("[data-life-health-nav='true']") ?? null;
    if (formTarget && summaryTarget && footerTarget && navTarget) return { formTarget, summaryTarget, footerTarget, navTarget };
  }
  const heading = Array.from(document.querySelectorAll("h2")).find((item) => item.textContent?.trim() === `${policyType} onboarding`);
  const notice = heading?.closest("section") as HTMLElement | null;
  const parent = notice?.parentElement;
  const source = notice?.previousElementSibling as HTMLElement | null;
  if (!notice || !parent || !source) return null;

  notice.dataset.lifeHealthNoticeHidden = "true";
  notice.style.display = "none";
  const navTarget = document.createElement("div"); navTarget.dataset.lifeHealthNav = "true";
  const layout = document.createElement("div");
  layout.dataset.lifeHealthLayout = "true";
  layout.className = "grid gap-4 xl:grid-cols-[minmax(0,1fr)_336px]";
  const left = document.createElement("div"); left.className = "space-y-3";
  const formTarget = document.createElement("div"); formTarget.dataset.lifeHealthPortal = "true";
  const summaryTarget = document.createElement("div"); summaryTarget.dataset.lifeHealthSummary = "true"; summaryTarget.className = "self-start";
  const footerTarget = document.createElement("div"); footerTarget.dataset.lifeHealthFooter = "true"; footerTarget.className = "mt-3 w-full";
  source.dataset.lifeHealthSource = "true";
  parent.insertBefore(navTarget, source);
  parent.insertBefore(layout, source);
  left.appendChild(source); left.appendChild(formTarget); layout.appendChild(left); layout.appendChild(summaryTarget);
  parent.insertBefore(footerTarget, notice);
  return { formTarget, summaryTarget, footerTarget, navTarget };
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
        if (next) setMount((current) => current?.formTarget === next.formTarget && current?.footerTarget === next.footerTarget && current?.navTarget === next.navTarget ? current : next);
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

  return mount && lifeHealthType ? <>
    {createPortal(<LifeHealthSectionNav />, mount.navTarget)}
    {createPortal(<LifeHealthPolicyForm policyType={lifeHealthType} insurers={insurers} customers={customers} sources={sources} summaryTarget={mount.summaryTarget} footerTarget={mount.footerTarget} />, mount.formTarget)}
  </> : null;
}
