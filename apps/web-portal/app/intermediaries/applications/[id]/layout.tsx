"use client";

import { useEffect, useRef, useState } from "react";

type StepState = "completed" | "active" | "upcoming";

export default function ApplicationReviewLayout({ children }: { children: React.ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [isPartnerReview, setIsPartnerReview] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const text = root.textContent ?? "";
    const partnerReview = text.includes("Individual Partner") || text.includes("Business Partner");
    setIsPartnerReview(partnerReview);

    root.querySelectorAll<HTMLAnchorElement | HTMLButtonElement>("a, button").forEach((action) => {
      const label = action.textContent?.trim().toLowerCase();
      if (label === "edit details") action.dataset.reviewAction = "edit";
      if (label === "create user") action.dataset.reviewAction = "create-user";

      if (label === "open linked account" && !action.closest("#linked-account")) {
        action.textContent = "Open POSP Account";
        action.dataset.headerPospAction = "true";
      }

      if (label === "open posp account" && action.closest("#linked-account")) {
        const wrapper = action.parentElement;
        action.remove();
        if (wrapper && wrapper.childElementCount === 0) wrapper.remove();
      }
    });

    root.querySelector("#linked-account")?.remove();
    normalizeWorkflowStepper(root);

    root.querySelectorAll<HTMLElement>("h1, h2, h3, p, span, dt").forEach((element) => {
      const label = element.textContent?.trim().toLowerCase();

      if (label === "open requirements") {
        element.closest("section")?.setAttribute("data-open-requirements", "true");
      }

      if (label === "posp account journey") {
        const section = element.closest<HTMLElement>("section");
        const steps = section?.querySelector<HTMLElement>("div[class*='grid']");
        if (section) section.dataset.pospJourney = "true";
        if (steps) steps.dataset.pospJourneySteps = "true";
      }

      if (label === "portal user status") {
        const stat = element.closest<HTMLElement>("div[class*='items-center']");
        if (stat) {
          stat.dataset.partnerPortalStatus = "true";
          const grid = stat.parentElement;
          if (grid) {
            grid.dataset.reviewHeaderStats = "true";
            if (partnerReview) grid.dataset.partnerHeaderStats = "true";
          }
        }
      }

      if (label === "aadhaar") {
        const field = element.parentElement;
        const value = field?.querySelector<HTMLElement>("dd");
        const current = value?.textContent?.trim() ?? "";
        const lastFour = current.match(/(\d{4})$/)?.[1];
        if (value && lastFour) value.textContent = `****${lastFour}`;
      }

      if (!partnerReview) return;

      if (label === "partner onboarding journey") {
        element.closest("section")?.setAttribute("data-partner-journey", "true");
      }

      if (label === "onboarding date") {
        const stat = element.closest<HTMLElement>("div[class*='items-center']");
        if (stat) stat.dataset.partnerOnboardingDate = "true";
      }
    });
  }, []);

  return (
    <div ref={rootRef} className={isPartnerReview ? "application-review-refined partner-review-refined" : "application-review-refined"}>
      {children}
      <style>{`
        .application-review-refined [data-open-requirements="true"] {
          display: none !important;
        }

        .application-review-refined [data-five-step-workflow="true"] {
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 1px !important;
          width: 100% !important;
        }

        .application-review-refined [data-five-step-workflow="true"] > a {
          min-width: 0 !important;
        }

        .application-review-refined [data-posp-journey="true"] {
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          padding: 0.15rem 0 0.35rem !important;
        }

        .application-review-refined [data-posp-journey="true"] > h2 {
          margin: 0 0 0.9rem !important;
          font-size: 0.82rem !important;
          font-weight: 650 !important;
          color: #17203a !important;
        }

        .application-review-refined [data-posp-journey-steps="true"] {
          position: relative !important;
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          gap: 0 !important;
          align-items: start !important;
          overflow: visible !important;
        }

        .application-review-refined [data-posp-journey-steps="true"]::before {
          content: "";
          position: absolute;
          top: 0.63rem;
          left: 10%;
          right: 10%;
          height: 1px;
          background: #cbd5e1;
          z-index: 0;
        }

        .application-review-refined [data-posp-journey-steps="true"] > div {
          position: relative !important;
          z-index: 1 !important;
          min-width: 0 !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: transparent !important;
          padding: 0 !important;
          text-align: center !important;
        }

        .application-review-refined [data-posp-journey-steps="true"] > div > div {
          width: 1.35rem !important;
          height: 1.35rem !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 0 0 5px #f8fafc !important;
        }

        .application-review-refined [data-posp-journey-steps="true"] > div > p {
          margin-top: 0.45rem !important;
          font-size: 0.58rem !important;
          font-weight: 600 !important;
          color: #24345a !important;
        }

        .application-review-refined [data-review-header-stats="true"] {
          width: 100% !important;
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        }

        .application-review-refined [data-review-header-stats="true"] > div {
          width: 100% !important;
          min-width: 0 !important;
        }

        .application-review-refined [data-header-posp-action="true"],
        .application-review-refined [data-review-action="edit"],
        .application-review-refined [data-review-action="create-user"] {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.55rem !important;
          min-width: 8rem !important;
          height: 2.5rem !important;
          padding: 0 1rem !important;
          border-radius: 0.85rem !important;
          font-weight: 600 !important;
        }

        .application-review-refined [data-review-action="edit"],
        .application-review-refined [data-review-action="create-user"] {
          border: 1px solid #ded8ce !important;
          background: #f3f0e9 !important;
          color: #071d49 !important;
          box-shadow: 0 1px 2px rgba(7, 29, 73, 0.08) !important;
        }

        .application-review-refined [data-review-action="edit"]::before {
          content: "✎";
          font-size: 0.82rem;
          line-height: 1;
        }

        .application-review-refined [data-review-action="create-user"]::before {
          content: "+";
          display: grid;
          width: 1.05rem;
          height: 1.05rem;
          place-items: center;
          border: 1px solid currentColor;
          border-radius: 999px;
          font-size: 0.72rem;
          line-height: 1;
        }

        .application-review-refined [data-review-action="edit"]:hover,
        .application-review-refined [data-review-action="create-user"]:hover {
          border-color: #cfc7bb !important;
          background: #ebe6dd !important;
        }

        .partner-review-refined [data-partner-journey="true"],
        .partner-review-refined [data-partner-onboarding-date="true"],
        .partner-review-refined #activity {
          display: none !important;
        }

        .partner-review-refined [data-partner-header-stats="true"] {
          grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        }

        .partner-review-refined [data-partner-portal-status="true"] {
          display: flex !important;
          order: 5 !important;
        }

        .partner-review-refined > div > div[class*="max-w-[1480px]"] {
          gap: 0.85rem !important;
        }

        @media (max-width: 1199px) {
          .application-review-refined [data-five-step-workflow="true"] {
            grid-template-columns: repeat(5, minmax(8.5rem, 1fr)) !important;
            overflow-x: auto !important;
          }

          .application-review-refined [data-review-header-stats="true"],
          .partner-review-refined [data-partner-header-stats="true"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 720px) {
          .application-review-refined [data-posp-journey-steps="true"] {
            overflow-x: auto !important;
            grid-template-columns: repeat(5, minmax(7rem, 1fr)) !important;
            padding-bottom: 0.35rem !important;
          }

          .application-review-refined [data-posp-journey-steps="true"]::before {
            left: 3.5rem;
            right: 3.5rem;
          }
        }

        @media (max-width: 639px) {
          .application-review-refined [data-header-posp-action="true"],
          .application-review-refined [data-review-action="edit"],
          .application-review-refined [data-review-action="create-user"] {
            min-width: auto !important;
          }

          .application-review-refined [data-review-header-stats="true"],
          .partner-review-refined [data-partner-header-stats="true"] {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}

function normalizeWorkflowStepper(root: HTMLElement) {
  const navigation = Array.from(root.querySelectorAll<HTMLElement>("nav")).find((nav) => {
    const labels = Array.from(nav.children).map((child) => child.textContent?.toLowerCase() ?? "");
    return labels.length === 6 && labels.some((label) => label.includes("primary details")) && labels.some((label) => label.includes("iib upload"));
  });

  if (!navigation) return;

  const original = Array.from(navigation.children) as HTMLAnchorElement[];
  const registration = original[2];
  const trainingExam = original[3];
  const agreement = original[4];
  const iib = original[5];
  if (!registration || !trainingExam || !agreement || !iib) return;

  const partnerLinked = registration.cloneNode(true) as HTMLAnchorElement;
  const training = trainingExam.cloneNode(true) as HTMLAnchorElement;
  const exam = trainingExam.cloneNode(true) as HTMLAnchorElement;
  const agreementStep = agreement.cloneNode(true) as HTMLAnchorElement;
  const activeStep = iib.cloneNode(true) as HTMLAnchorElement;

  const trainingState = readStepState(trainingExam);
  const pageText = root.textContent?.toLowerCase() ?? "";
  const examPassed = /exam\s*(status)?\s*:?\s*passed/.test(pageText);
  const examStarted = !examPassed && /exam\s*(status)?\s*:?\s*(allotted|in progress|started)/.test(pageText);

  configureStep(partnerLinked, 1, "Partner linked", readStepState(registration), "#registration-requirement");
  configureStep(training, 2, "Training", trainingState, "#training-requirement");
  configureStep(
    exam,
    3,
    "Exam",
    examPassed ? "completed" : examStarted ? "active" : trainingState === "completed" ? "active" : "upcoming",
    "#training-requirement",
  );
  configureStep(agreementStep, 4, "Agreement", readStepState(agreement), "#agreement-requirement");
  configureStep(activeStep, 5, "POSP active", readStepState(iib), "#iib-submission");

  navigation.replaceChildren(partnerLinked, training, exam, agreementStep, activeStep);
  navigation.dataset.fiveStepWorkflow = "true";
}

function readStepState(step: HTMLElement): StepState {
  const status = step.textContent?.toLowerCase() ?? "";
  if (status.includes("completed")) return "completed";
  if (status.includes("current")) return "active";
  return "upcoming";
}

function configureStep(step: HTMLAnchorElement, number: number, label: string, state: StepState, hash: string) {
  const url = new URL(step.href, window.location.origin);
  url.hash = hash;
  step.href = `${url.pathname}${url.search}${url.hash}`;

  const circle = step.querySelector<HTMLElement>("span");
  const paragraphs = step.querySelectorAll<HTMLElement>("p");
  const title = paragraphs[0];
  const status = paragraphs[1];

  if (title) title.textContent = label;
  if (status) status.textContent = state === "completed" ? "Completed" : state === "active" ? "Current" : "Upcoming";
  if (circle) circle.textContent = state === "completed" ? "✓" : String(number);

  step.classList.toggle("bg-[#EEF4FF]", state === "active");

  if (circle) {
    circle.className = `grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ${state === "completed" ? "bg-emerald-600 text-white" : state === "active" ? "bg-[#071D49] text-white" : "bg-slate-100 text-slate-400"}`;
  }

  if (title) {
    title.className = `text-[10px] font-semibold ${state === "active" ? "text-[#071D49]" : state === "completed" ? "text-emerald-800" : "text-slate-500"}`;
  }
}
