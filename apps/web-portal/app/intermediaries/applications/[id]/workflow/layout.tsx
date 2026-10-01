import type { ReactNode } from "react";
import { MobileNumberFormatCompatibility } from "./mobile-number-format-compatibility";
import { WorkflowStageNavigationCompatibility } from "./workflow-stage-navigation-compatibility";
import styles from "./workflow-theme.module.css";

export default function IntermediaryWorkflowLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.workflowTheme}>
      <MobileNumberFormatCompatibility />
      <WorkflowStageNavigationCompatibility />
      {children}
    </div>
  );
}
