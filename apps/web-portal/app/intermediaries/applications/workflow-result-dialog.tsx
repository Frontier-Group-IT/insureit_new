"use client";

import { useEffect, useState } from "react";
import { freshDynamicRouteUrl } from "@/components/fresh-dynamic-route-navigation";

type Props = { applicationId: string; event: string | null };
type DialogConfig = {
  eyebrow: string;
  title: string;
  message: string;
  nextStep: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  celebratory?: boolean;
};

export function WorkflowResultDialog({ applicationId, event }: Props) {
  const config = event ? configFor(event, applicationId, detectIntermediaryType()) : null;
  const [visible, setVisible] = useState(false);
  const seenKey = event && config ? `workflow-result-dialog:${applicationId}:${event}` : null;

  useEffect(() => {
    if (!config || !event || !seenKey) return;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("success");
    window.history.replaceState(window.history.state, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);

    if (sessionStorage.getItem(seenKey) === "seen") {
      setVisible(false);
      return;
    }

    sessionStorage.setItem(seenKey, "seen");
    setVisible(true);

    const onKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") navigateFresh(`/intermediaries/applications/${applicationId}`);
    };
    const onPageShow = (pageEvent: PageTransitionEvent) => {
      if (pageEvent.persisted && sessionStorage.getItem(seenKey) === "seen") setVisible(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [applicationId, config, event, seenKey]);

  if (!config || !visible) return null;
  const closeHref = `/intermediaries/applications/${applicationId}`;

  if (config.celebratory) {
    return (
      <div className="fixed inset-0 z-[2147483000] grid place-items-center bg-[#081127]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="process-result-title">
        <div className="w-full max-w-[380px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_26px_80px_rgba(8,17,39,.28)]">
          <div className="flex items-start gap-3 px-5 pb-4 pt-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[18px] font-bold text-emerald-700">✓</span>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#635BFF]">Success</p>
              <h2 id="process-result-title" className="mt-1 text-[17px] font-semibold leading-tight text-[#0F172A]">{config.title}</h2>
            </div>
            <button type="button" onClick={() => navigateFresh(closeHref)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#E2E8F0] bg-white text-[16px] text-[#64748B] transition hover:bg-[#F8FAFC]">×</button>
          </div>
          <div className={`grid gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 ${config.secondaryHref ? "sm:grid-cols-2" : ""}`}>
            {config.secondaryHref && config.secondaryLabel ? (
              <button type="button" onClick={() => navigateFresh(config.secondaryHref!)} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-center text-[10px] font-semibold text-[#334155]">{config.secondaryLabel}</button>
            ) : null}
            <button type="button" onClick={() => navigateFresh(config.primaryHref)} className="rounded-xl bg-[#071D49] px-4 py-2.5 text-center text-[10px] font-semibold text-white">{config.primaryLabel}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2147483000] grid place-items-center bg-[#081127]/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="process-result-title">
      <div className="w-full max-w-[460px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_28px_90px_rgba(8,17,39,.28)]">
        <div className={`relative px-5 py-5 text-center ${config.celebratory ? "bg-gradient-to-br from-[#071D49] via-[#0A3277] to-[#2563EB] text-white" : "border-b border-[#E2E8F0]"}`}>
          {config.celebratory ? (
            <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full border border-white/30 bg-white/15 text-3xl shadow-lg">✓</div>
          ) : null}
          <button type="button" onClick={() => navigateFresh(closeHref)} aria-label="Close" className={`absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg border text-[16px] ${config.celebratory ? "border-white/25 bg-white/10 text-white" : "border-[#DCE5EF] text-[#64748B]"}`}>×</button>
          <p className={`text-[9px] font-semibold uppercase tracking-[.1em] ${config.celebratory ? "text-blue-100" : "text-[#64748B]"}`}>{config.eyebrow}</p>
          <h2 id="process-result-title" className={`mt-1 text-[18px] font-semibold ${config.celebratory ? "text-white" : "text-[#0F172A]"}`}>{config.title}</h2>
        </div>

        <div className="space-y-3 px-5 py-5 text-center">
          <p className="text-[10.5px] leading-5 text-[#475569]">{config.message}</p>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-left">
            <p className="text-[8.5px] font-semibold uppercase tracking-[.08em] text-blue-700">Next step</p>
            <p className="mt-1 text-[10px] font-semibold text-blue-950">{config.nextStep}</p>
          </div>
        </div>

        <div className={`grid gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 ${config.secondaryHref ? "sm:grid-cols-2" : ""}`}>
          {config.secondaryHref && config.secondaryLabel ? (
            <button type="button" onClick={() => navigateFresh(config.secondaryHref!)} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-center text-[10px] font-semibold text-[#334155]">{config.secondaryLabel}</button>
          ) : null}
          <button type="button" onClick={() => navigateFresh(config.primaryHref)} className="rounded-xl bg-[#071D49] px-4 py-2.5 text-center text-[10px] font-semibold text-white">{config.primaryLabel}</button>
        </div>
      </div>
    </div>
  );
}

function detectIntermediaryType(): "POSP" | "MISP" {
  if (typeof document === "undefined") return "POSP";
  const text = document.body.textContent?.toUpperCase() ?? "";
  return text.includes("MISP ACCOUNT") || text.includes("MISP APPLICATION") ? "MISP" : "POSP";
}

function navigateFresh(href: string) {
  window.location.assign(freshDynamicRouteUrl(href));
}

function configFor(event: string, applicationId: string, intermediaryType: "POSP" | "MISP"): DialogConfig | null {
  const application = `/intermediaries/applications/${applicationId}`;
  const configs: Record<string, DialogConfig> = {
    documents_completed: {
      eyebrow: "Partner registration complete",
      title: "Partner ID created",
      message: "The Partner ID has been generated successfully and the updated Partner account is now available.",
      nextStep: "Continue to the refreshed account review and verify the generated Partner ID.",
      primaryLabel: "Continue",
      primaryHref: application,
      celebratory: true,
    },
    training_assigned: { eyebrow: "Training assignment", title: "Training assigned", message: "The training material and completion instructions are now available to the intermediary.", nextStep: "Monitor the training status and record completion when the requirement is fulfilled.", primaryLabel: "View training", primaryHref: `${application}?stage=review`, secondaryLabel: "Open intermediary list", secondaryHref: "/intermediaries" },
    training_status_updated: { eyebrow: "Training status", title: "Training status updated", message: "The latest training progress has been recorded successfully.", nextStep: "After training is completed, allot the examination.", primaryLabel: "Continue to application", primaryHref: `${application}?stage=review`, secondaryLabel: "Back to applications", secondaryHref: "/customers/posp-misp" },
    exam_allotted: { eyebrow: "Examination assignment", title: "Examination allotted", message: "The examination details have been saved and made available to the intermediary.", nextStep: "Record the official examination result after the attempt is completed.", primaryLabel: "View examination", primaryHref: `${application}?stage=review`, secondaryLabel: "Open intermediary list", secondaryHref: "/intermediaries" },
    exam_passed: { eyebrow: "Examination result", title: "Examination passed", message: "The intermediary has successfully completed the examination requirement.", nextStep: "Send the approved agreement for signing.", primaryLabel: "Send agreement", primaryHref: `${application}?stage=review`, secondaryLabel: "View result", secondaryHref: `${application}?stage=review` },
    exam_failed: { eyebrow: "Examination result", title: "Examination result recorded", message: "The unsuccessful result has been recorded against the current attempt.", nextStep: "Review the permitted attempts and arrange another examination attempt where applicable.", primaryLabel: "Review examination", primaryHref: `${application}?stage=review`, secondaryLabel: "Back to applications", secondaryHref: "/customers/posp-misp" },
    agreement_sent: { eyebrow: "Agreement process", title: "Agreement sent", message: "The signing link is now available to the intermediary in the portal.", nextStep: "Monitor the agreement status and record it as signed after completion.", primaryLabel: "View agreement status", primaryHref: `${application}?stage=review`, secondaryLabel: "Open intermediary list", secondaryHref: "/intermediaries" },
    agreement_signed: { eyebrow: "Agreement process", title: "Agreement signed", message: "The agreement requirement has been completed successfully.", nextStep: "Proceed with IIB registration when the IIB submission stage is enabled.", primaryLabel: "Open application", primaryHref: `${application}?stage=review`, secondaryLabel: "Open intermediary list", secondaryHref: "/intermediaries" },
    onboarding_completed: {
      eyebrow: `${intermediaryType} registration complete`,
      title: `${intermediaryType} ID created`,
      message: `The ${intermediaryType} ID has been generated successfully and the updated account is ready for review.`,
      nextStep: `Continue to the refreshed account review and verify the generated ${intermediaryType} ID.`,
      primaryLabel: "Continue",
      primaryHref: application,
      celebratory: true,
    },
  };
  return configs[event] ?? null;
}
