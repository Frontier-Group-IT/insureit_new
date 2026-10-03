import type { ReactNode } from "react";

export default function EditPolicyTemplate({ children }: { children: ReactNode }) {
  return (
    <div id="life-health-issued-edit-scope">
      {children}
      <style>{`
        /* Issued Life / Health edit already shows proposal, insurer, product and customer in the main form. */
        #life-health-issued-edit-scope aside > .space-y-4 > :nth-child(2),
        #life-health-issued-edit-scope aside > .space-y-4 > :nth-child(3),
        #life-health-issued-edit-scope aside > .space-y-4 > :nth-child(4),
        #life-health-issued-edit-scope aside > .space-y-4 > :nth-child(5) {
          display: none;
        }
      `}</style>
    </div>
  );
}
