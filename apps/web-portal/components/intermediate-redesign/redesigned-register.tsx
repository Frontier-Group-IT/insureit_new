"use client";

import { useMemo, useState } from "react";
import { Users, FileText, CheckCircle, Clock } from "lucide-react";
import { StatCard, FilterToolbar, FilterPill } from "./table";
import type { ColumnDef } from "./table";
import { StatusBadge, LifecycleBadge } from "./status-badge";
import type { StatusTone } from "./status-badge";
import type { IntermediaryRow, ApplicationState } from "./types";
import { createIntermediaryPortalLogin } from "@/app/intermediaries/portal-account-actions";
import { resendIntermediaryPortalInvite } from "@/app/intermediaries/resend-portal-invite-action";
import { createLinkedIntermediaryAccount } from "@/app/intermediaries/applications/[id]/account-review-actions";
import { FreshAccountReviewLink } from "@/app/intermediaries/applications/account-review-back-link";
import { FormSubmitButton } from "@/components/form-submit-button";

export interface RedesignedRegisterProps {
  selectedType: "posp" | "misp" | "partner" | null;
  rows: IntermediaryRow[];
  applicationMap: Map<string, ApplicationState>;
  search?: string;
  success?: string;
  error?: string;
  canCreate: boolean;
  canReview: boolean;
  counts: { posp: number; misp: number; partner: number };
}

const REGISTERED_STATUS = "iib_registered";

export default function RedesignedIntermediaryRegister({
  selectedType,
  rows,
  applicationMap,
  search = "",
  success,
  error,
  canCreate,
  canReview,
  counts,
}: RedesignedRegisterProps) {
  const [internalSearch, setInternalSearch] = useState(search);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // setSelectedIds is wired to batch actions via the FilterToolbar when
  // selection mode is enabled. Suppressed here to avoid lint noise.
  void setSelectedIds;
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const isPartnerView = selectedType === "partner";
  const isTypedView = selectedType === "posp" || selectedType === "misp";

  const successMessage =
    success === "portal_login_invited"
      ? "Password creation link sent."
      : success === "portal_invite_resent"
        ? "A fresh password creation link has been sent."
        : success === "documents_completed"
          ? "Documents saved and Partner activated."
          : "Action completed.";

  // Filter pills visible only when there's no active type filter
  const filterPills = !selectedType
    ? [
        { key: "posp" as const, label: "POSP", value: counts.posp },
        { key: "misp" as const, label: "MISP", value: counts.misp },
        { key: "partner" as const, label: "Partners", value: counts.partner },
      ]
    : [];

  // Define columns — must be inside component to access canReview, selectedType, applicationMap
  const columns = useMemo<ColumnDef<IntermediaryRow>[]>(
    () => (isPartnerView ? buildPartnerColumns(canReview, applicationMap) : buildDefaultColumns(canReview, applicationMap)),
    [canReview, isPartnerView, applicationMap]
  );

  // Client-side filtering
  const filteredRows = useMemo(() => {
    if (!activeFilter) return rows;
    return rows.filter((row) => {
      const app = applicationMap.get(row.application_id ?? "");
      return accountStatusFilter(row, app, activeFilter);
    });
  }, [rows, applicationMap, activeFilter]);

  function accountStatusFilter(row: IntermediaryRow, _app: ApplicationState | undefined, filter: string): boolean {
    switch (filter) {
      case "suspended":
        return row.account_status === "suspended";
      case "inactive":
        return row.account_status === "inactive";
      case "pending":
      default:
        return row.account_status === "active" || row.account_status === "pending";
    }
  }

  // ---- Bulk actions ----
  const bulkActions = selectedIds.length > 0
    ? [
        { label: "Send portal invites", onClick: () => {} },
        { label: "Resend invites", onClick: () => {} },
        { label: "Export selected", onClick: () => {} },
      ]
    : undefined;

  return (
    <div className="mx-auto max-w-[1480px] space-y-4 pb-6">
      {/* --- Search + Filter Toolbar --- */}
      <FilterToolbar
        searchPlaceholder={
          selectedType
            ? `Search ${selectedType.toUpperCase()} name, mobile, email or ID`
            : "Search name, ID, location or RM"
        }
        searchValue={internalSearch}
        onSearchChange={setInternalSearch}
        onSearchSubmit={(val) => {
          const params = new URLSearchParams();
          if (val.trim()) params.set("q", val.trim());
          const action = selectedType ? `/intermediaries/${selectedType}` : "/intermediaries";
          window.location.href = `${action}?${params.toString()}`;
        }}
        onSearchClear={() => setInternalSearch("")}
        filters={[
          {
            key: "account_status",
            label: "Status",
            options: [
              { value: "pending", label: "Pending" },
              { value: "suspended", label: "Suspended" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
        activeFilterKey={activeFilter}
        activeFilterValue={activeFilter ?? ""}
        onFilterChange={(_key, value) => setActiveFilter(value || null)}
        selectedCount={selectedIds.length}
        bulkActions={bulkActions}
        rightAction={
          canCreate && isTypedView ? (
            <FreshAccountReviewLink
              href={`/customers/posp-misp/new?partner_type=${selectedType}`}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-brand-navy-500 to-brand-cyan-500 px-5 text-[10.5px] font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-navy-500 focus:ring-offset-2"
            >
              Onboard {selectedType!.toUpperCase()}
            </FreshAccountReviewLink>
          ) : null
        }
      />

      {/* --- Filter Pills (Overview only) --- */}
      {!selectedType && filterPills.length > 0 ? (
        <section>
          <div className="flex gap-3">
            {filterPills.map((pill) => (
              <FilterPill
                key={pill.key}
                label={pill.label}
                value={pill.value}
                active={activeFilter === pill.key}
                onClick={() => setActiveFilter(activeFilter === pill.key ? null : pill.key)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* --- Success / Error banners --- */}
      {success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[10.5px] font-medium text-green-700">
          {successMessage}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-medium text-red-700">
          {decodeURIComponent(error)}
        </div>
      ) : null}

      {/* --- Stat Cards --- */}
      {!selectedType ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="POSP accounts" value={counts.posp} icon={<Users className="h-5 w-5" />} tone="info" />
          <StatCard label="MISP accounts" value={counts.misp} icon={<FileText className="h-5 w-5" />} tone="info" />
          <StatCard label="Total Partners" value={counts.partner} icon={<Users className="h-5 w-5" />} tone="default" />
        </section>
      ) : isTypedView ? (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Total" value={rows.length} icon={<Users className="h-5 w-5" />} tone="default" />
          <StatCard
            label="Active"
            value={rows.filter((r) => {
              const app = applicationMap.get(r.application_id ?? "");
              return (app?.registration_status ?? "") === REGISTERED_STATUS;
            }).length}
            icon={<CheckCircle className="h-5 w-5" />}
            tone="success"
          />
          <StatCard
            label="Under onboarding"
            value={rows.filter((r) => {
              const app = applicationMap.get(r.application_id ?? "");
              return (app?.registration_status ?? "") !== REGISTERED_STATUS;
            }).length}
            icon={<Clock className="h-5 w-5" />}
            tone="warning"
          />
        </section>
      ) : null}

      {/* --- Main Table --- */}
      <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-200 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-neutral-700">
            {isPartnerView ? "Partner register" : "Intermediary register"}
          </h2>
          <p className="mt-0.5 text-[10px] text-neutral-500">
            Current onboarding position, ownership and next action for every {selectedType ?? "intermediary"} account.
          </p>
        </div>

        <table className="w-full min-w-[1000px] table-fixed align-top">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={
                    "sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/90 " +
                    "px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.04em] text-neutral-500 " +
                    "backdrop-blur " +
                    (col.width ?? "")
                  }
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {filteredRows.map((row, i) => (
              <tr
                key={row.id}
                className={
                  "group transition-colors " +
                  (i % 2 === 1 ? "bg-neutral-50/50 " : "") +
                  "hover:bg-neutral-50".replace(/\s+/g, " ").trim()
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={
                      "px-4 py-2.5 align-top " +
                      "text-[12px] text-neutral-800".replace(/\s+/g, " ").trim()
                    }
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {filteredRows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-[12px] font-semibold text-neutral-600">No records found</p>
            <p className="mt-1 text-[11px] text-neutral-500">
              Adjust your search or filter to find more records, or clear all filters.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

// =====================================================
// Column builders — closures capturing canReview + applicationMap
// =====================================================

function buildDefaultColumns(canReview: boolean, applicationMap: Map<string, ApplicationState>): ColumnDef<IntermediaryRow>[] {
  return [
    {
      key: "account_label",
      label: "Account type",
      width: "w-36",
      render: (row) => {
        const label = row.intermediary_type === "partner"
          ? row.account_status === "active" ? "Partner" : "Partner onboarding"
          : `${row.intermediary_type.toUpperCase()} onboarding`;
        return <StatusBadge value={label} />;
      },
    },
    {
      key: "name",
      label: "Name",
      width: "w-44",
      render: (row) => (
        <>
          {row.application_id ? (
            <FreshAccountReviewLink
              href={`/intermediaries/applications/${row.application_id}`}
              className="font-semibold text-neutral-800 hover:text-brand-navy-600 hover:underline"
            >
              {row.display_name}
            </FreshAccountReviewLink>
          ) : (
            <span className="font-semibold text-neutral-800">{row.display_name}</span>
          )}
          {row.city ? <p className="mt-0.5 max-w-[180px] truncate text-[10px] text-neutral-500">{row.city}</p> : null}
        </>
      ),
    },
    {
      key: "id",
      label: "Account ID",
      width: "w-32",
      render: (row) => {
        const id = row.intermediary_code ?? row.onboarding_id ?? "Pending";
        return <span className="block max-w-[120px] truncate font-mono text-[10.5px] font-medium text-neutral-700">{id}</span>;
      },
    },
    {
      key: "parent_partner",
      label: "Parent partner",
      width: "w-32",
      render: (row) => {
        const app = row.application_id ? applicationMap.get(row.application_id) : undefined;
        const partnerId =
          (row.intermediary_code?.startsWith("PART-") ? row.intermediary_code : undefined) ??
          (row.onboarding_id?.startsWith("PART-") ? row.onboarding_id : undefined) ??
          (app?.draft_data?.legacy_partner_code ? String(app.draft_data.legacy_partner_code) : undefined) ??
          "Partner ID pending";
        return <span className="block max-w-[120px] truncate text-[10.5px] text-neutral-600">{partnerId}</span>;
      },
    },
    {
      key: "contact",
      label: "Contact",
      width: "w-40",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-[10.5px] text-neutral-700">{row.mobile ?? "—"}</span>
          {row.email ? <span className="mt-0.5 max-w-[160px] truncate text-[10px] text-neutral-500">{row.email}</span> : null}
        </div>
      ),
    },
    {
      key: "workflow",
      label: "Workflow",
      width: "w-40",
      render: (row) => {
        const app = row.application_id ? applicationMap.get(row.application_id) : undefined;
        const lifecycle = deriveLifecycle(row, app);
        return (
          <div className="flex flex-col gap-0.5">
            <LifecycleBadge value={lifecycle.stage} completed={lifecycle.completed} active={lifecycle.active} />
            <span className="text-[9px] text-neutral-500">{lifecycle.account}</span>
          </div>
        );
      },
    },
    {
      key: "portal_access",
      label: "Portal access",
      width: "w-36",
      render: (row) => {
        let tone: StatusTone;
        let label: string;
        switch (row.portal_access_status) {
          case "active": tone = "success"; label = "Active"; break;
          case "invited": tone = "info"; label = "Invitation sent"; break;
          case "disabled":
          case "suspended": tone = "error"; label = "Disabled"; break;
          default: tone = "pending"; label = "Not created";
        }
        return <StatusBadge value={label} tone={tone} />;
      },
    },
    {
      key: "action",
      label: "Action",
      width: "w-44",
      render: (row) => {
        if (!row.application_id) return <span className="text-neutral-400">—</span>;

        const primary = (
          <FreshAccountReviewLink
            href={`/intermediaries/applications/${row.application_id}`}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-gradient-to-r from-brand-navy-600 to-brand-cyan-500 px-3 text-[9.5px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            View account
          </FreshAccountReviewLink>
        );

        // If the user can review and has portal-action capability, show secondary button
        const secondary = canReview && row.portal_access_status === "not_created" ? (
          <form action={createIntermediaryPortalLogin}>
            <input type="hidden" name="intermediary_id" value={row.id} />
            <FormSubmitButton
              label="Create user"
              pendingLabel="Sending link"
              className="h-8 rounded-lg border border-neutral-300 bg-white px-3 text-[9.5px] font-semibold text-neutral-700"
            />
          </form>
        ) : canReview && row.portal_access_status === "invited" ? (
          <form action={resendIntermediaryPortalInvite}>
            <input type="hidden" name="intermediary_id" value={row.id} />
            <FormSubmitButton
              label="Resend link"
              pendingLabel="Sending..."
              className="h-8 rounded-lg border border-neutral-300 bg-white px-3 text-[9.5px] font-semibold text-neutral-700"
            />
          </form>
        ) : null;

        return (
          <div className="flex items-center justify-end gap-2">
            {secondary}
            {primary}
          </div>
        );
      },
    },
  ];
}

function buildPartnerColumns(canReview: boolean, applicationMap: Map<string, ApplicationState>): ColumnDef<IntermediaryRow>[] {
  return [
    {
      key: "partner",
      label: "Partner",
      width: "w-44",
      render: (row) => {
        const app = row.application_id ? applicationMap.get(row.application_id) : undefined;
        const loc = (app?.draft_data?.city ? String(app.draft_data.city) : undefined) ?? row.city ?? "—";
        return (
          <>
            {row.application_id ? (
              <FreshAccountReviewLink
                href={`/intermediaries/applications/${row.application_id}`}
                className="font-semibold text-neutral-800 hover:text-brand-navy-600 hover:underline"
              >
                {row.display_name}
              </FreshAccountReviewLink>
            ) : (
              <span className="font-semibold text-neutral-800">{row.display_name}</span>
            )}
            <p className="mt-1 max-w-[180px] truncate text-[9.5px] text-neutral-500">{loc}</p>
          </>
        );
      },
    },
    {
      key: "partner_id",
      label: "Partner ID",
      width: "w-32",
      render: (row) => (
        <span className="block max-w-[120px] truncate font-mono text-[10.5px] font-medium text-neutral-700">
          {row.intermediary_code ?? "Partner ID pending"}
        </span>
      ),
    },
    {
      key: "type",
      label: "Type",
      width: "w-28",
      render: (row) => (
        <span className="text-[10.5px] text-neutral-700">
          {row.requested_type === "misp" ? "Business" : "Individual"}
        </span>
      ),
    },
    {
      key: "assigned_rm",
      label: "Assigned RM",
      width: "w-36",
      render: (row) => {
        const app = row.application_id ? applicationMap.get(row.application_id) : undefined;
        const rm = (app?.draft_data?.associate_name ? String(app.draft_data.associate_name) : undefined) ?? "Not assigned";
        const rmClass = rm === "Not assigned" ? "text-amber-700" : "text-neutral-700";
        return <span className={`text-[10.5px] ${rmClass}`}>{rm}</span>;
      },
    },
    {
      key: "linked_account",
      label: "Linked account",
      width: "w-32",
      render: (row) => {
        const app = row.application_id ? applicationMap.get(row.application_id) : undefined;
        const status = app?.registration_status ?? "";
        const label = status === REGISTERED_STATUS ? "Active" : "Onboarding";
        const tone: StatusTone = status === REGISTERED_STATUS ? "success" : "warning";
        return <StatusBadge value={label} tone={tone} />;
      },
    },
    {
      key: "portal_access",
      label: "Portal access",
      width: "w-32",
      render: (row) => {
        let tone: StatusTone;
        let label: string;
        switch (row.portal_access_status) {
          case "active": tone = "success"; label = "Active"; break;
          case "invited": tone = "info"; label = "Invitation sent"; break;
          default: tone = "pending"; label = "Not created";
        }
        return <StatusBadge value={label} tone={tone} />;
      },
    },
    {
      key: "status",
      label: "Status",
      width: "w-28",
      render: (row) => {
        const app = row.application_id ? applicationMap.get(row.application_id) : undefined;
        const status = (app?.partner_status ?? row.account_status) ?? "";
        let label: string;
        let tone: StatusTone;
        if (status === "active_partner" || status === "active") { tone = "success"; label = "Active"; }
        else if (status === "suspended_partner" || status === "suspended") { tone = "error"; label = "Suspended"; }
        else if (status === "inactive_partner" || status === "inactive") { tone = "warning"; label = "Inactive"; }
        else if (status === "rejected") { tone = "error"; label = "Rejected"; }
        else { tone = "pending"; label = "Pending"; }
        return <StatusBadge value={label} tone={tone} />;
      },
    },
    {
      key: "action",
      label: "Action",
      width: "w-36",
      render: (row) => {
        const app = row.application_id ? applicationMap.get(row.application_id) : undefined;
        const isPartnerActive = (app?.partner_status ?? row.account_status) === "active_partner" || row.account_status === "active";

        if (!row.application_id) return <span className="text-neutral-400">—</span>;

        const canCreateLinked = canReview && isPartnerActive;

        if (canCreateLinked) {
          const linkedType: "posp" | "misp" = app?.requested_type ?? row.requested_type;
          return (
            <form action={createLinkedIntermediaryAccount}>
              <input type="hidden" name="application_id" value={row.application_id} />
              <input type="hidden" name="registration_type" value={linkedType} />
              <FormSubmitButton
                label={`Create ${linkedType.toUpperCase()}`}
                pendingLabel="Creating"
                className="h-8 rounded-lg bg-gradient-to-r from-brand-navy-500 to-brand-navy-700 px-3 text-[9.5px] font-semibold text-white disabled:opacity-60"
              />
            </form>
          );
        }

        return (
          <FreshAccountReviewLink
            href={`/intermediaries/applications/${row.application_id}`}
            className="inline-flex h-8 items-center justify-center rounded-lg bg-gradient-to-r from-brand-navy-600 to-brand-cyan-500 px-3 text-[9.5px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            View account
          </FreshAccountReviewLink>
        );
      },
    },
  ];
}

// =====================================================
// Helper functions
// =====================================================

function deriveLifecycle(
  row: IntermediaryRow,
  app?: ApplicationState
): { stage: string; account: string; completed: boolean; active: boolean } {
  const status = app?.registration_status ?? "";
  const context = (app?.draft_data?.account_context as string | undefined) ?? row.intermediary_type;

  if (context === "partner") {
    if (app?.partner_status === "active_partner") return { stage: "Active Partner", account: "Active Partner", completed: true, active: false };
    if (status === "documents_pending") return { stage: "Documents Pending", account: "Partner Onboarding", completed: false, active: true };
    return { stage: "Pending Partner", account: "Partner Onboarding", completed: false, active: true };
  }

  if (status === "iib_registered") return { stage: `Active ${context.toUpperCase()}`, account: `Active ${context.toUpperCase()}`, completed: true, active: false };
  if (status.includes("iib") || status.includes("upload")) return { stage: "IIB Upload Pending", account: "Under Onboarding", completed: false, active: true };
  if (status.includes("agreement") && !status.includes("complete")) return { stage: "Agreement Pending", account: "Under Onboarding", completed: false, active: true };
  if (status.includes("agreement") && status.includes("complete")) return { stage: "IIB Upload Pending", account: "Under Onboarding", completed: false, active: true };
  if (status.includes("training") && status.includes("complete")) return { stage: "Training Completed", account: "Under Onboarding", completed: false, active: true };
  if (status.includes("training") || status.includes("exam")) return { stage: "Training Started", account: "Under Onboarding", completed: false, active: true };
  return { stage: `${context.toUpperCase()} Onboarding Pending`, account: "Under Onboarding", completed: false, active: true };
}
