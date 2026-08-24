import type { ReactNode } from "react";
import styles from "../../accounts-copy-cleanup.module.css";

export default function CommercialReviewLayout({ children }: { children: ReactNode }) {
  return <div className={styles.clean}>{children}</div>;
}
