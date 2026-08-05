import type { ReactNode } from "react";
import styles from "./workflow-theme.module.css";

export default function IntermediaryWorkflowLayout({ children }: { children: ReactNode }) {
  return <div className={styles.workflowTheme}>{children}</div>;
}
