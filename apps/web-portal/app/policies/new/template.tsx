import type { ReactNode } from "react";

export default function NewPolicyTemplate({ children }: { children: ReactNode }) {
  return (
    <div id="life-health-summary-dedup-scope">
      {children}
      <style>{`
        /* Life / Health onboarding already shows case and customer details in the main form. */
        #life-health-policy-summary-fixed-card aside > div:nth-child(2) > :nth-child(1),
        #life-health-policy-summary-fixed-card aside > div:nth-child(2) > :nth-child(2),
        #life-health-summary-dedup-scope #life-health-form-grid aside > div:nth-child(2) > :nth-child(1),
        #life-health-summary-dedup-scope #life-health-form-grid aside > div:nth-child(2) > :nth-child(2) {
          display: none;
        }
      `}</style>
    </div>
  );
}
