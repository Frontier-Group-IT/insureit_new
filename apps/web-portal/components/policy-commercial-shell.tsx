"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PolicyUnifiedForm,
  type PolicyRmOption,
  type PolicySourceOption,
  type PolicyUnifiedInitialValues,
} from "@/components/policy-unified-form";

export type PolicyCommercialShellProps = {
  mode: "create" | "edit";
  insurers: Array<{ label: string; value: string }>;
  rms: PolicyRmOption[];
  sources: PolicySourceOption[];
  manufacturers?: string[];
  initialValues?: PolicyUnifiedInitialValues;
  commercialAccess: boolean;
};

type ModalKind = "payin" | "payout" | null;

/**
 * Commercial orchestration for the policy form.
 *
 * Projected pay-in and partner payout are optional commercial inputs.
 * Billing is deliberately excluded from the visible policy-onboarding UI and
 * is protected server-side from amount-only/projected writes.
 */
export function PolicyCommercialShell(props: PolicyCommercialShellProps) {
  const [modal, setModal] = useState<ModalKind>(null);

  const sanitizedInitialValues = useMemo(() => {
    if (props.commercialAccess || !props.initialValues) return props.initialValues;
    return {
      ...props.initialValues,
      payoutBasis: "",
      projectedOdPercent: "",
      projectedTpPercent: "",
      insurerScheme: "",
      payinBillNo: "",
      payinBilledAmount: "",
      payinBillDate: "",
      payinStatus: "Unbilled",
      retention: "",
      payoutOdPercent: "",
      payoutTpPercent: "",
      payoutStatus: "Pending",
      payoutDate: "",
      payoutVoucherNo: "",
    } satisfies PolicyUnifiedInitialValues;
  }, [props.commercialAccess, props.initialValues]);

  // Legacy compatibility only: the underlying form still derives a billed
  // amount in create mode. Clear that transient value before submission until
  // the final form-state extraction is completed. The server billing action
  // independently rejects amount-only billing writes.
  useEffect(() => {
    if (props.mode !== "create" || !props.commercialAccess) return;
    let attempts = 0;
    let stopped = false;

    const neutralizeLegacyAutoBilling = () => {
      if (stopped || attempts++ > 12) return;
      const section = document.querySelector<HTMLElement>("[data-policy-commercial-shell] #policy-section-4");
      const toggle = Array.from(section?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.includes("Billing Details"));
      if (!section || !toggle) {
        window.setTimeout(neutralizeLegacyAutoBilling, 80);
        return;
      }

      toggle.click();
      window.setTimeout(() => {
        const labels = Array.from(section.querySelectorAll("label"));
        const label = labels.find((item) => item.textContent?.includes("PayIn Billed Amt"));
        const container = label?.parentElement?.parentElement ?? label?.parentElement;
        const input = container?.querySelector<HTMLInputElement>('input[type="number"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
          setter?.call(input, "");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const closeToggle = Array.from(section.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Hide Billing Details"));
        closeToggle?.click();
      }, 0);
    };

    const timer = window.setTimeout(neutralizeLegacyAutoBilling, 50);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [props.commercialAccess, props.mode]);

  useEffect(() => {
    if (!modal) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [modal]);

  return (
    <div
      data-policy-commercial-shell
      data-commercial-modal-open={modal ?? ""}
      data-commercial-access={props.commercialAccess ? "allowed" : "restricted"}
      className="policy-commercial-shell"
    >
      <style>{`
        .policy-commercial-shell #policy-section-4,
        .policy-commercial-shell #policy-section-5 { display:none; }
        .policy-commercial-shell .sticky button:nth-child(4),
        .policy-commercial-shell .sticky button:nth-child(5) { display:none; }
        .policy-commercial-shell[data-commercial-modal-open="payin"] #policy-section-4,
        .policy-commercial-shell[data-commercial-modal-open="payout"] #policy-section-5 {
          display:block;
          position:fixed;
          z-index:102;
          left:50%;
          top:50%;
          width:min(720px,calc(100vw - 28px));
          max-height:min(76vh,680px);
          overflow:auto;
          transform:translate(-50%,-50%);
          box-shadow:0 30px 90px rgba(15,23,42,.28);
        }
        /* Projected pay-in popup: never expose legacy billing or retention. */
        .policy-commercial-shell #policy-section-4 > div:nth-child(2) > div:nth-child(4),
        .policy-commercial-shell #policy-section-4 > div:nth-child(2) > div:last-child > button { display:none; }
        /* Partner payout popup: commercial rates only; settlement is a separate workflow. */
        .policy-commercial-shell #policy-section-5 > div:nth-child(2) > div:nth-child(3),
        .policy-commercial-shell #policy-section-5 > div:nth-child(2) > div:nth-child(4),
        .policy-commercial-shell #policy-section-5 > div:nth-child(2) > div:last-child > button { display:none; }
        .policy-commercial-shell[data-commercial-access="restricted"] [data-commercial-sensitive] { display:none!important; }
      `}</style>

      <CommercialEntryCard access={props.commercialAccess} onOpen={setModal} />

      <PolicyUnifiedForm
        mode={props.mode}
        insurers={props.insurers}
        rms={props.rms}
        sources={props.sources}
        manufacturers={props.manufacturers}
        initialValues={sanitizedInitialValues}
      />

      {modal ? (
        <div className="fixed inset-0 z-[101] bg-[#0F172A]/45 backdrop-blur-[2px]" onMouseDown={() => setModal(null)}>
          <button
            type="button"
            className="fixed right-5 top-5 z-[104] rounded-full border border-white/30 bg-white px-3 py-1.5 text-[10px] font-bold text-[#17365D] shadow-lg"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => setModal(null)}
          >
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CommercialEntryCard({ access, onOpen }: { access: boolean; onOpen: (kind: Exclude<ModalKind, null>) => void }) {
  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-[#D9E2F0] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#E5EAF1] bg-[#FBFCFE] px-4 py-3">
        <div>
          <h2 className="text-[13px] font-semibold text-[#17365D]">Commercials</h2>
          <p className="mt-0.5 text-[9px] text-[#667085]">Optional sensitive commercial terms. Billing is handled separately from onboarding.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[8px] font-bold ${access ? "bg-[#EAF7F2] text-[#18794E]" : "bg-[#F2F4F7] text-[#667085]"}`}>
          {access ? "Authorized" : "Restricted"}
        </span>
      </div>

      {access ? (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onOpen("payin")}
            className="group rounded-xl border border-[#D8E2EF] bg-[linear-gradient(135deg,#F8FBFF,#F1F6FC)] px-4 py-4 text-left transition hover:border-[#9FB5D3] hover:shadow-sm"
          >
            <div className="text-[10px] font-bold text-[#17365D]">Projected Pay-in</div>
            <div className="mt-1 text-[9px] leading-4 text-[#667085]">Expected OD, TP/CPA and scheme pay-in only. A 0% rate is valid.</div>
            <div className="mt-3 text-[9px] font-bold text-[#315B9A]">Open details →</div>
          </button>
          <button
            type="button"
            onClick={() => onOpen("payout")}
            className="group rounded-xl border border-[#D8E2EF] bg-[linear-gradient(135deg,#FBFCFF,#F6F4FF)] px-4 py-4 text-left transition hover:border-[#B9AED8] hover:shadow-sm"
          >
            <div className="text-[10px] font-bold text-[#17365D]">Partner Payout</div>
            <div className="mt-1 text-[9px] leading-4 text-[#667085]">Actual agreed OD and TP/CPA payout commercial. A 0% rate is valid.</div>
            <div className="mt-3 text-[9px] font-bold text-[#5D4E9C]">Open details →</div>
          </button>
        </div>
      ) : (
        <div className="p-4">
          <div className="rounded-xl border border-dashed border-[#D7DDE6] bg-[#F8FAFC] px-4 py-4 text-[10px] font-semibold text-[#667085]">
            Commercial details restricted
          </div>
        </div>
      )}
    </section>
  );
}
