"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = { applicationId: string; event: string | null };
type DialogConfig = { title: string; message: string; primaryLabel: string; primaryHref: string; secondaryLabel: string; secondaryHref: string };

export function WorkflowResultDialog({ applicationId, event }: Props) {
  const router = useRouter();
  const config = event ? configFor(event, applicationId) : null;

  useEffect(() => {
    if (!config) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") router.replace(`/intermediaries/applications/${applicationId}`); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applicationId, config, router]);

  if (!config) return null;
  const closeHref = `/intermediaries/applications/${applicationId}`;

  return <div className="fixed inset-0 z-[2147483000] grid place-items-center bg-[#081127]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="workflow-result-title">
    <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_28px_90px_rgba(8,17,39,.28)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#E2E8F0] px-5 py-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[#64748B]">Workflow update</p><h2 id="workflow-result-title" className="mt-1 text-[16px] font-semibold text-[#0F172A]">{config.title}</h2></div><Link href={closeHref} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg border border-[#DCE5EF] text-[16px] text-[#64748B]">×</Link></div>
      <div className="px-5 py-4"><p className="text-[10.5px] leading-5 text-[#475569]">{config.message}</p></div>
      <div className="grid gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4 sm:grid-cols-2"><Link href={config.secondaryHref} className="rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-center text-[10px] font-semibold text-[#334155]">{config.secondaryLabel}</Link><Link href={config.primaryHref} className="rounded-xl bg-[#071D49] px-4 py-2.5 text-center text-[10px] font-semibold text-white">{config.primaryLabel}</Link></div>
    </div>
  </div>;
}

function configFor(event: string, applicationId: string): DialogConfig | null {
  const application = `/intermediaries/applications/${applicationId}`;
  const configs: Record<string, DialogConfig> = {
    documents_completed: { title: "Documents completed", message: "The application is ready for training assignment.", primaryLabel: "Assign training", primaryHref: `${application}?stage=review`, secondaryLabel: "Back to applications", secondaryHref: "/customers/posp-misp" },
    training_assigned: { title: "Training assigned", message: "The training material has been saved for this intermediary.", primaryLabel: "View training status", primaryHref: `${application}?stage=review`, secondaryLabel: "Open intermediary list", secondaryHref: "/intermediaries" },
    training_status_updated: { title: "Training status updated", message: "The current training progress has been saved.", primaryLabel: "Continue workflow", primaryHref: `${application}?stage=review`, secondaryLabel: "Back to applications", secondaryHref: "/customers/posp-misp" },
    exam_allotted: { title: "Examination allotted", message: "The examination will remain locked until training is completed.", primaryLabel: "View examination", primaryHref: `${application}?stage=review`, secondaryLabel: "Open intermediary list", secondaryHref: "/intermediaries" },
    exam_passed: { title: "Examination passed", message: "The application is ready for the digital agreement stage.", primaryLabel: "Continue workflow", primaryHref: `${application}?stage=review`, secondaryLabel: "Open intermediary list", secondaryHref: "/intermediaries" },
    exam_failed: { title: "Examination result saved", message: "The failed result has been recorded. The examination may be reassigned according to the permitted attempts.", primaryLabel: "Review examination", primaryHref: `${application}?stage=review`, secondaryLabel: "Back to applications", secondaryHref: "/customers/posp-misp" },
    onboarding_completed: { title: "Onboarding completed", message: "The intermediary registration has been completed.", primaryLabel: "Open intermediary", primaryHref: "/intermediaries", secondaryLabel: "Back to applications", secondaryHref: "/customers/posp-misp" },
  };
  return configs[event] ?? null;
}
