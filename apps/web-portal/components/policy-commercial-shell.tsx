"use client";

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

/**
 * Thin server-to-client access boundary.
 * The unified form now owns its commercial card and native popups directly;
 * there is no DOM insertion, hidden-section CSS, or billing-neutralization hack.
 */
export function PolicyCommercialShell(props: PolicyCommercialShellProps) {
  return (
    <PolicyUnifiedForm
      mode={props.mode}
      insurers={props.insurers}
      rms={props.rms}
      sources={props.sources}
      manufacturers={props.manufacturers}
      initialValues={props.initialValues}
      commercialAccess={props.commercialAccess}
    />
  );
}
