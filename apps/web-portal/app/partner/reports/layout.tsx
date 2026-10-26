import type { ReactNode } from "react";
import "../../reports/reporting.css";
import "../../reports/reporting-navigation.css";
import "../../reports/reporting-register.css";
import "../../reports/reporting-v2.css";

/** Partner portal retains its own authenticated navigation and scoped loaders. */
export default function PartnerReportsLayout({ children }: { children: ReactNode }) {
  return children;
}
