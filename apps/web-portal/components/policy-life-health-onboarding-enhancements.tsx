"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const YEAR_OPTIONS = Array.from({ length: 50 }, (_, index) => `${index + 1} Year${index === 0 ? "" : "s"}`);

function labelContainer(prefix: string) {
  const label = Array.from(document.querySelectorAll("label")).find((item) =>
    item.textContent?.trim().toLowerCase().startsWith(prefix.toLowerCase())
  );
  return label?.parentElement ?? null;
}

function setReactInputValue(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function enhanceTermField(prefix: string, options: string[]) {
  const container = labelContainer(prefix);
  const input = container?.querySelector("input") as HTMLInputElement | null;
  if (!container || !input || container.querySelector("select[data-policy-term-select]")) return;

  const select = document.createElement("select");
  select.dataset.policyTermSelect = prefix;
  select.className = input.className;
  select.setAttribute("aria-label", prefix);
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select term";
  select.appendChild(placeholder);
  for (const value of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
  select.value = input.value;
  select.addEventListener("change", () => setReactInputValue(input, select.value));
  input.style.display = "none";
  input.setAttribute("aria-hidden", "true");
  input.insertAdjacentElement("afterend", select);
}

function enhanceRmEmployeeId() {
  const container = labelContainer("Intermediary type");
  if (!container) return;
  const rmMeta = Array.from(container.querySelectorAll("span,div")).find((node) => node.textContent?.trim().startsWith("RM ·"));
  if (!rmMeta || container.querySelector("[data-rm-employee-id]")) return;

  const leadContainer = labelContainer("Lead source");
  const leadSelect = leadContainer?.querySelector("select") as HTMLSelectElement | null;
  if (!leadSelect?.value) return;

  const sourceText = leadSelect.options[leadSelect.selectedIndex]?.textContent ?? "";
  const sourceCode = sourceText.split("·").pop()?.trim() ?? "";
  if (!sourceCode) return;

  const id = document.createElement("span");
  id.dataset.rmEmployeeId = "true";
  id.className = "ml-2 text-[10px] font-semibold text-[#244C73]";
  id.textContent = `ID · ${sourceCode}`;
  rmMeta.insertAdjacentElement("afterend", id);
}

export function PolicyLifeHealthOnboardingEnhancements() {
  const [popupError, setPopupError] = useState<string | null>(null);
  const dismissedRef = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const policyType = (labelContainer("Policy type")?.querySelector("select") as HTMLSelectElement | null)?.value;
      if (policyType !== "Life" && policyType !== "Health") return;

      enhanceTermField("PPT · Premium Paying Term", ["Single Pay", ...YEAR_OPTIONS]);
      enhanceTermField("PD · Policy Duration / Term", YEAR_OPTIONS);
      enhanceRmEmployeeId();

      const errorNodes = Array.from(document.querySelectorAll<HTMLElement>(".text-red-700, .text-red-600"));
      const visibleError = errorNodes.find((node) => node.offsetParent !== null && node.textContent?.trim());
      const message = visibleError?.textContent?.trim() ?? "";
      if (message && message !== dismissedRef.current) setPopupError(message);
    };

    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.addEventListener("change", sync, true);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("change", sync, true);
    };
  }, []);

  if (!popupError || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-[1px]" role="dialog" aria-modal="true" aria-labelledby="policy-error-title">
      <div className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-red-100 bg-white shadow-2xl">
        <div className="flex items-start gap-3 px-5 py-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-red-600"><AlertTriangle className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h2 id="policy-error-title" className="text-[13px] font-bold text-[#17203A]">Unable to continue</h2>
            <p className="mt-1 text-[11px] leading-5 text-[#475467]">{popupError}</p>
          </div>
          <button type="button" aria-label="Close error" onClick={() => { dismissedRef.current = popupError; setPopupError(null); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#667085] hover:bg-[#F2F4F7]"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex justify-end border-t border-[#EAECF0] bg-[#F9FAFB] px-5 py-3">
          <button type="button" onClick={() => { dismissedRef.current = popupError; setPopupError(null); }} className="h-9 rounded-xl bg-[#17365D] px-5 text-[10px] font-bold text-white">OK</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
