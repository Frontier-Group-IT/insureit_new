"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { FilterX, Plus, Search, ShieldCheck } from "lucide-react";
import { ExternalPolicyMuiTheme } from "./mui-demo-theme";

type ExternalPolicyRow = {
  id: string;
  policy_no: string;
  policy_type: string;
  start_date: string;
  end_date: string;
  insured_declared_value: number | null;
  premium_amount: number | null;
  added_via: string;
  created_at: string;
  customers: { company_name: string | null; contact_name: string } | null;
  vehicles: { vehicle_no: string } | null;
  insurance_companies: { name: string } | null;
  claim_count: number;
};

type PolicyState = "Active" | "Expiring soon" | "Expired";
type ExternalPolicyViewRow = ExternalPolicyRow & { status: PolicyState };
type ViewKey = "all" | "active" | "expiring" | "expired" | "claims";

const MOBILE_PAGE_SIZE = 10;

export function ExternalPolicyWorkspace({ rows, canEdit }: { rows: ExternalPolicyRow[]; canEdit: boolean }) {
  return (
    <ExternalPolicyMuiTheme>
      <ExternalPolicyWorkspaceContent rows={rows} canEdit={canEdit} />
    </ExternalPolicyMuiTheme>
  );
}

function ExternalPolicyWorkspaceContent({ rows, canEdit }: { rows: ExternalPolicyRow[]; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>("all");
  const [insurer, setInsurer] = useState("all");
  const [mobilePage, setMobilePage] = useState(1);

  const enriched = useMemo<ExternalPolicyViewRow[]>(
    () => rows.map((row) => ({ ...row, status: policyStatus(row.end_date) })),
    [rows],
  );

  const stats = useMemo(() => ({
    active: enriched.filter((row) => row.status === "Active").length,
    expiring: enriched.filter((row) => row.status === "Expiring soon").length,
    expired: enriched.filter((row) => row.status === "Expired").length,
    claims: enriched.filter((row) => row.claim_count > 0).length,
  }), [enriched]);

  const insurers = useMemo(
    () => Array.from(new Set(rows.map((row) => row.insurance_companies?.name).filter(Boolean))).sort() as string[],
    [rows],
  );

  const filtered = useMemo(() => enriched.filter((row) => {
    const haystack = [
      row.policy_no,
      row.policy_type,
      row.insurance_companies?.name,
      row.vehicles?.vehicle_no,
      row.customers?.company_name,
      row.customers?.contact_name,
      row.added_via,
    ].filter(Boolean).join(" ").toLowerCase();

    const matchesInsurer = insurer === "all" || row.insurance_companies?.name === insurer;
    const matchesView = view === "all"
      || (view === "active" && row.status === "Active")
      || (view === "expiring" && row.status === "Expiring soon")
      || (view === "expired" && row.status === "Expired")
      || (view === "claims" && row.claim_count > 0);

    return matchesInsurer && matchesView && (!query.trim() || haystack.includes(query.trim().toLowerCase()));
  }), [enriched, insurer, query, view]);

  const mobilePages = Math.max(1, Math.ceil(filtered.length / MOBILE_PAGE_SIZE));
  const safeMobilePage = Math.min(mobilePage, mobilePages);
  const mobileRows = filtered.slice((safeMobilePage - 1) * MOBILE_PAGE_SIZE, safeMobilePage * MOBILE_PAGE_SIZE);

  function resetFilters() {
    setQuery("");
    setView("all");
    setInsurer("all");
    setMobilePage(1);
  }

  const columns = useMemo<GridColDef<ExternalPolicyViewRow>[]>(() => [
    {
      field: "policy_no",
      headerName: "Policy No.",
      minWidth: 175,
      flex: 1.06,
      renderCell: ({ row }) => (
        <Box sx={{ minWidth: 0, width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: .15 }}>
          {canEdit ? (
            <Typography
              component={Link}
              href={`/policies/external/${row.id}/edit`}
              variant="body2"
              noWrap
              sx={{
                alignSelf: "flex-start",
                maxWidth: "100%",
                fontWeight: 900,
                color: "primary.main",
                textDecoration: "none",
                lineHeight: 1.25,
                "&:hover": { textDecoration: "underline", textUnderlineOffset: "3px" },
                "&:focus-visible": { outline: "2px solid", outlineColor: "primary.light", outlineOffset: "2px", borderRadius: .5 },
              }}
            >
              {row.policy_no}
            </Typography>
          ) : (
            <Typography variant="body2" noWrap sx={{ fontWeight: 900, color: "text.primary", lineHeight: 1.25 }}>{row.policy_no}</Typography>
          )}
          <Typography variant="caption" noWrap color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>{row.policy_type}</Typography>
        </Box>
      ),
    },
    {
      field: "customer",
      headerName: "Customer",
      minWidth: 175,
      flex: 1.08,
      sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ minWidth: 0, width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: .15 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700, lineHeight: 1.25 }}>{row.customers?.contact_name ?? "-"}</Typography>
          {row.customers?.company_name ? <Typography variant="caption" noWrap color="text.secondary" sx={{ display: "block", lineHeight: 1.2 }}>{row.customers.company_name}</Typography> : null}
        </Box>
      ),
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 118,
      flex: .74,
      sortable: false,
      renderCell: ({ row }) => <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>{row.vehicles?.vehicle_no ?? "-"}</Typography>,
    },
    {
      field: "insurer",
      headerName: "Insurer",
      minWidth: 165,
      flex: 1.03,
      sortable: false,
      renderCell: ({ row }) => (
        <Tooltip title={row.insurance_companies?.name ?? "-"} arrow placement="top">
          <Typography variant="body2" noWrap sx={{ width: "100%", fontWeight: 650 }}>{row.insurance_companies?.name ?? "-"}</Typography>
        </Tooltip>
      ),
    },
    {
      field: "validity",
      headerName: "Validity",
      minWidth: 178,
      flex: 1.06,
      sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ minWidth: 0, width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: .15 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700, lineHeight: 1.25 }}>{formatDate(row.start_date)} – {formatDate(row.end_date)}</Typography>
          <Typography
            variant="caption"
            sx={{ display: "block", lineHeight: 1.2, fontWeight: row.status === "Expiring soon" ? 750 : 500 }}
            color={row.status === "Expired" ? "error.main" : row.status === "Expiring soon" ? "warning.main" : "text.secondary"}
          >
            {validityHint(row.end_date)}
          </Typography>
        </Box>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 108,
      flex: .66,
      renderCell: ({ row }) => <PolicyStatus status={row.status} />,
    },
    {
      field: "insured_declared_value",
      headerName: "IDV",
      minWidth: 106,
      flex: .68,
      align: "right",
      headerAlign: "right",
      renderCell: ({ row }) => <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(row.insured_declared_value)}</Typography>,
    },
    {
      field: "premium_amount",
      headerName: "Premium",
      minWidth: 108,
      flex: .68,
      align: "right",
      headerAlign: "right",
      renderCell: ({ row }) => <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(row.premium_amount)}</Typography>,
    },
    {
      field: "claim_count",
      headerName: "Claims",
      width: 72,
      align: "center",
      headerAlign: "center",
      renderCell: ({ row }) => row.claim_count
        ? <Chip size="small" label={row.claim_count} color="warning" variant="outlined" />
        : <Typography variant="body2" color="text.secondary">0</Typography>,
    },
  ], [canEdit]);

  return (
    <Box sx={{ mx: "auto", maxWidth: 1480, pb: 1 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
          <Box minWidth={0}>
            <Typography variant="h5">External Policies</Typography>
          </Box>
        </Stack>
        {canEdit ? (
          <Button component={Link} href="/policies/external/new" variant="contained" startIcon={<Plus size={16} />} sx={{ alignSelf: { xs: "stretch", sm: "center" } }}>
            Add External Policy
          </Button>
        ) : null}
      </Stack>

      <Paper variant="outlined" sx={{ borderColor: "#DCE5EF", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,.035)" }}>
        <Box sx={{ px: { xs: 1.25, md: 1.5 }, py: 1.05, borderBottom: "1px solid", borderColor: "divider", bgcolor: "#FFFFFF" }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }}>
            <TextField
              value={query}
              onChange={(event) => { setQuery(event.target.value); setMobilePage(1); }}
              placeholder="Search policy, customer, vehicle or insurer"
              size="small"
              sx={{ width: { xs: "100%", md: 370 } }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={16} color="#738097" /></InputAdornment> } }}
            />
            <TextField
              select
              size="small"
              value={insurer}
              onChange={(event) => { setInsurer(event.target.value); setMobilePage(1); }}
              sx={{ width: { xs: "100%", md: 205 } }}
            >
              <MenuItem value="all">All insurers</MenuItem>
              {insurers.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </TextField>
            <Tooltip title="Reset filters">
              <span>
                <IconButton aria-label="Reset filters" onClick={resetFilters} disabled={!query && insurer === "all" && view === "all"} sx={{ width: 36, height: 36, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <FilterX size={16} />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        <Box sx={{ borderBottom: "1px solid", borderColor: "divider", px: 1, bgcolor: "#FAFBFD" }}>
          <Tabs
            value={view}
            onChange={(_, next: ViewKey) => { setView(next); setMobilePage(1); }}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="External policy views"
            sx={{ minHeight: 40, "& .MuiTab-root": { minHeight: 40, px: 2, py: .75, fontSize: 12.5 } }}
          >
            <Tab value="all" label={`All (${rows.length})`} />
            <Tab value="active" label={`Active (${stats.active})`} />
            <Tab value="expiring" label={`Renewal due (${stats.expiring})`} />
            <Tab value="expired" label={`Expired (${stats.expired})`} />
            <Tab value="claims" label={`Claims (${stats.claims})`} />
          </Tabs>
        </Box>

        <Box sx={{ display: { xs: "none", md: "block" }, height: 610 }}>
          <DataGrid
            rows={filtered}
            columns={columns}
            rowHeight={62}
            columnHeaderHeight={42}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
            slots={{ noRowsOverlay: NoPoliciesOverlay }}
            sx={{
              border: 0,
              "& .MuiDataGrid-columnHeaders": { bgcolor: "#F7F9FC", borderBottom: "1px solid #DDE5EF" },
              "& .MuiDataGrid-columnHeaderTitle": { fontSize: 10.5, fontWeight: 800, letterSpacing: ".035em", textTransform: "uppercase", color: "#64748B" },
              "& .MuiDataGrid-cell": { borderBottom: "1px solid #EEF2F6", display: "flex", alignItems: "center", outline: "none !important" },
              "& .MuiDataGrid-row:hover": { bgcolor: "#F8FAFC" },
              "& .MuiDataGrid-footerContainer": { minHeight: 46, borderTop: "1px solid #E2E8F0", bgcolor: "#FAFBFD" },
              "& .MuiTablePagination-root": { color: "#526079" },
              "& .MuiDataGrid-overlayWrapper": { minHeight: 220 },
            }}
          />
        </Box>

        <Box sx={{ display: { xs: "block", md: "none" }, p: 1, bgcolor: "#F8FAFC" }}>
          <Stack spacing={.8}>
            {mobileRows.map((policy) => <MobilePolicyCard key={policy.id} policy={policy} canEdit={canEdit} />)}
            {!mobileRows.length ? <NoPoliciesOverlay /> : null}
          </Stack>
          {filtered.length > MOBILE_PAGE_SIZE ? (
            <Stack alignItems="center" sx={{ pt: 1.5, pb: .5 }}>
              <Pagination count={mobilePages} page={safeMobilePage} onChange={(_, page) => setMobilePage(page)} color="primary" size="small" />
            </Stack>
          ) : null}
        </Box>
      </Paper>
    </Box>
  );
}

function MobilePolicyCard({ policy, canEdit }: { policy: ExternalPolicyViewRow; canEdit: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.25, borderColor: "#DCE5EF", boxShadow: "none" }}>
      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
        <Box minWidth={0}>
          {canEdit ? (
            <Typography
              component={Link}
              href={`/policies/external/${policy.id}/edit`}
              variant="body2"
              noWrap
              sx={{ display: "block", fontWeight: 900, color: "primary.main", textDecoration: "none", "&:hover": { textDecoration: "underline", textUnderlineOffset: "3px" } }}
            >
              {policy.policy_no}
            </Typography>
          ) : (
            <Typography variant="body2" noWrap sx={{ fontWeight: 900 }}>{policy.policy_no}</Typography>
          )}
          <Typography variant="caption" noWrap color="text.secondary">{policy.insurance_companies?.name ?? "-"}</Typography>
        </Box>
        <PolicyStatus status={policy.status} />
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 1.25, rowGap: .6, mt: 1 }}>
        <MobileValue label="Customer" value={policy.customers?.contact_name ?? "-"} />
        <MobileValue label="Vehicle" value={policy.vehicles?.vehicle_no ?? "-"} />
        <MobileValue label="Validity" value={`${formatDate(policy.start_date)} – ${formatDate(policy.end_date)}`} />
        <MobileValue label="Premium" value={formatCurrency(policy.premium_amount)} />
      </Box>
    </Paper>
  );
}

function MobileValue({ label, value }: { label: string; value: string }) {
  return (
    <Box minWidth={0}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 9.5 }}>{label}</Typography>
      <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{value}</Typography>
    </Box>
  );
}

function NoPoliciesOverlay() {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={.7} sx={{ minHeight: 200, p: 2.5, textAlign: "center" }}>
      <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#EEF4FF", color: "primary.main" }}><ShieldCheck size={18} /></Box>
      <Typography variant="body2" sx={{ fontWeight: 800 }}>No matching policies</Typography>
    </Stack>
  );
}

function PolicyStatus({ status }: { status: PolicyState }) {
  if (status === "Expired") return <Chip size="small" color="error" variant="outlined" label="Expired" />;
  if (status === "Expiring soon") return <Chip size="small" color="warning" variant="outlined" label="Renewal due" />;
  return <Chip size="small" color="success" variant="outlined" label="Active" />;
}

function validityHint(endDate: string) {
  const days = daysUntil(endDate);
  return days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Expires today" : `${days}d left`;
}

function policyStatus(endDate: string): PolicyState {
  const days = daysUntil(endDate);
  return days < 0 ? "Expired" : days <= 30 ? "Expiring soon" : "Active";
}

function daysUntil(endDate: string) {
  const end = new Date(`${endDate}T23:59:59`);
  const now = new Date();
  if (Number.isNaN(end.getTime())) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "2-digit" }).format(date);
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0, style: "currency", currency: "INR" }).format(value);
}