"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Alert,
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
import {
  ExternalLink,
  FileText,
  FilterX,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
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
type ExternalPolicyViewRow = ExternalPolicyRow & { status: PolicyState; daysLeft: number };
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
    () => rows.map((row) => ({ ...row, status: policyStatus(row.end_date), daysLeft: daysUntil(row.end_date) })),
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
      headerName: "Policy",
      minWidth: 170,
      flex: 1.15,
      sortable: true,
      renderCell: ({ row }) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 900, color: "text.primary", letterSpacing: ".01em" }}>{row.policy_no}</Typography>
          <Typography variant="caption" noWrap color="text.secondary">{row.policy_type}</Typography>
        </Box>
      ),
    },
    {
      field: "customer",
      headerName: "Customer",
      minWidth: 190,
      flex: 1.25,
      sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 800 }}>{row.customers?.contact_name ?? "-"}</Typography>
          <Typography variant="caption" noWrap color="text.secondary">{row.customers?.company_name ?? "Individual account"}</Typography>
        </Box>
      ),
    },
    {
      field: "vehicle",
      headerName: "Vehicle",
      minWidth: 125,
      flex: .85,
      sortable: false,
      renderCell: ({ row }) => <Typography variant="body2" sx={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 800 }}>{row.vehicles?.vehicle_no ?? "-"}</Typography>,
    },
    {
      field: "insurer",
      headerName: "Insurer",
      minWidth: 165,
      flex: 1.05,
      sortable: false,
      renderCell: ({ row }) => <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{row.insurance_companies?.name ?? "-"}</Typography>,
    },
    {
      field: "validity",
      headerName: "Validity",
      minWidth: 175,
      flex: 1.1,
      sortable: false,
      renderCell: ({ row }) => (
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{formatDate(row.start_date)} – {formatDate(row.end_date)}</Typography>
          <Typography variant="caption" color={row.status === "Expired" ? "error.main" : row.status === "Expiring soon" ? "warning.main" : "text.secondary"}>{validityHint(row.end_date)}</Typography>
        </Box>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      minWidth: 125,
      flex: .78,
      renderCell: ({ row }) => <PolicyStatus status={row.status} />,
    },
    {
      field: "insured_declared_value",
      headerName: "IDV",
      minWidth: 115,
      flex: .75,
      align: "right",
      headerAlign: "right",
      renderCell: ({ row }) => <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(row.insured_declared_value)}</Typography>,
    },
    {
      field: "premium_amount",
      headerName: "Premium",
      minWidth: 115,
      flex: .75,
      align: "right",
      headerAlign: "right",
      renderCell: ({ row }) => <Typography variant="body2" sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(row.premium_amount)}</Typography>,
    },
    {
      field: "claim_count",
      headerName: "Claims",
      width: 82,
      align: "center",
      headerAlign: "center",
      renderCell: ({ row }) => <Chip size="small" label={row.claim_count} color={row.claim_count ? "warning" : "default"} variant={row.claim_count ? "filled" : "outlined"} />,
    },
    {
      field: "actions",
      headerName: "Action",
      width: 104,
      sortable: false,
      filterable: false,
      align: "center",
      headerAlign: "center",
      renderCell: ({ row }) => canEdit ? (
        <Button component={Link} href={`/policies/external/${row.id}/edit`} size="small" variant="outlined" sx={{ minHeight: 32, borderRadius: 2, px: 1.5 }}>Open</Button>
      ) : (
        <Chip size="small" label="Read only" variant="outlined" />
      ),
    },
  ], [canEdit]);

  return (
    <Box sx={{ mx: "auto", maxWidth: 1480, pb: 1 }}>
      <Paper
        variant="outlined"
        sx={{
          position: "relative",
          overflow: "hidden",
          borderColor: "#D9E3F0",
          background: "linear-gradient(125deg, #FFFFFF 0%, #F6F8FF 58%, #EEF7FF 100%)",
          boxShadow: "0 20px 55px rgba(23,54,93,.08)",
        }}
      >
        <Box sx={{ position: "absolute", width: 260, height: 260, borderRadius: "50%", bgcolor: "rgba(99,91,255,.08)", filter: "blur(18px)", right: -90, top: -130 }} />
        <Box sx={{ position: "relative", p: { xs: 2, sm: 2.5, lg: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
            <Stack direction="row" spacing={1.6} alignItems="flex-start">
              <Box sx={{ width: 48, height: 48, borderRadius: 3, display: "grid", placeItems: "center", color: "white", background: "linear-gradient(145deg,#17365D,#635BFF)", boxShadow: "0 14px 30px rgba(56,64,160,.22)", flexShrink: 0 }}>
                <ExternalLink size={21} />
              </Box>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h4">External Policy Portfolio</Typography>
                  <Chip label="External coverage" size="small" color="secondary" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: .8, maxWidth: 760 }}>
                  Customer-recorded policies linked to existing customers and vehicles, kept separate from the SIBL production register and business calculations.
                </Typography>
              </Box>
            </Stack>
            {canEdit ? (
              <Button component={Link} href="/policies/external/new" variant="contained" color="primary" startIcon={<Plus size={17} />} sx={{ minHeight: 44, px: 2.3, alignSelf: { xs: "stretch", md: "center" } }}>
                Add External Policy
              </Button>
            ) : null}
          </Stack>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", md: "repeat(4,minmax(0,1fr))" }, gap: 1.25, mt: 2.5 }}>
            <MetricCard label="Total policies" value={rows.length} hint="Accessible records" icon={<FileText size={18} />} tone="navy" />
            <MetricCard label="Active cover" value={stats.active} hint="Currently in force" icon={<ShieldCheck size={18} />} tone="green" />
            <MetricCard label="Renewal due" value={stats.expiring} hint="Within 30 days" icon={<TrendingUp size={18} />} tone="amber" />
            <MetricCard label="Expired" value={stats.expired} hint="Coverage gap" icon={<TriangleAlert size={18} />} tone="red" />
          </Box>
        </Box>
      </Paper>

      <Alert severity="info" variant="outlined" sx={{ mt: 1.5, borderRadius: 3, bgcolor: "rgba(239,246,255,.72)", alignItems: "center" }}>
        External policies remain available for customer, vehicle and claim linkage, but are intentionally excluded from Sankalp policy production figures.
      </Alert>

      <Paper variant="outlined" sx={{ mt: 1.5, borderColor: "#DCE5EF", overflow: "hidden", boxShadow: "0 12px 35px rgba(15,23,42,.06)" }}>
        <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: "1px solid", borderColor: "divider", bgcolor: "#FFFFFF" }}>
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.2} alignItems={{ xs: "stretch", lg: "center" }} justifyContent="space-between">
            <TextField
              value={query}
              onChange={(event) => { setQuery(event.target.value); setMobilePage(1); }}
              placeholder="Search policy, insurer, vehicle or customer"
              size="small"
              sx={{ width: { xs: "100%", lg: 390 } }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={17} color="#738097" /></InputAdornment> } }}
            />
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                select
                size="small"
                label="Insurance company"
                value={insurer}
                onChange={(event) => { setInsurer(event.target.value); setMobilePage(1); }}
                sx={{ minWidth: { xs: 0, sm: 215 }, flex: { xs: 1, sm: "0 0 auto" } }}
              >
                <MenuItem value="all">All insurers</MenuItem>
                {insurers.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <Tooltip title="Reset filters">
                <span>
                  <IconButton aria-label="Reset filters" onClick={resetFilters} disabled={!query && insurer === "all" && view === "all"} sx={{ width: 42, height: 42, border: "1px solid", borderColor: "divider", borderRadius: 2.5 }}>
                    <FilterX size={17} />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ borderBottom: "1px solid", borderColor: "divider", px: { xs: .5, sm: 1.5 }, bgcolor: "#FBFCFE" }}>
          <Tabs
            value={view}
            onChange={(_, next: ViewKey) => { setView(next); setMobilePage(1); }}
            variant="scrollable"
            scrollButtons="auto"
            aria-label="External policy views"
          >
            <Tab value="all" label={<TabLabel label="All" count={rows.length} />} />
            <Tab value="active" label={<TabLabel label="Active" count={stats.active} />} />
            <Tab value="expiring" label={<TabLabel label="Renewal due" count={stats.expiring} />} />
            <Tab value="expired" label={<TabLabel label="Expired" count={stats.expired} />} />
            <Tab value="claims" label={<TabLabel label="Claims" count={stats.claims} />} />
          </Tabs>
        </Box>

        <Box sx={{ display: { xs: "none", md: "block" }, height: 680 }}>
          <DataGrid
            rows={filtered}
            columns={columns}
            rowHeight={58}
            columnHeaderHeight={48}
            disableRowSelectionOnClick
            pageSizeOptions={[10, 25, 50]}
            initialState={{ pagination: { paginationModel: { page: 0, pageSize: 10 } } }}
            slots={{ noRowsOverlay: NoPoliciesOverlay }}
            sx={{
              border: 0,
              "& .MuiDataGrid-columnHeaders": { bgcolor: "#F8FAFC", borderBottom: "1px solid #DDE5EF" },
              "& .MuiDataGrid-columnHeaderTitle": { fontSize: 10.5, fontWeight: 900, letterSpacing: ".045em", textTransform: "uppercase", color: "#5D6A7F" },
              "& .MuiDataGrid-cell": { borderBottom: "1px solid #EEF2F6", display: "flex", alignItems: "center", outline: "none !important" },
              "& .MuiDataGrid-row:hover": { bgcolor: "#F8FBFF" },
              "& .MuiDataGrid-footerContainer": { borderTop: "1px solid #E2E8F0", bgcolor: "#FBFCFE" },
              "& .MuiTablePagination-root": { color: "#526079" },
              "& .MuiDataGrid-overlayWrapper": { minHeight: 260 },
            }}
          />
        </Box>

        <Box sx={{ display: { xs: "block", md: "none" }, p: 1.5, bgcolor: "#F8FAFC" }}>
          <Stack spacing={1.2}>
            {mobileRows.map((policy) => <MobilePolicyCard key={policy.id} policy={policy} canEdit={canEdit} />)}
            {!mobileRows.length ? <NoPoliciesOverlay /> : null}
          </Stack>
          {filtered.length > MOBILE_PAGE_SIZE ? (
            <Stack alignItems="center" sx={{ pt: 2, pb: .5 }}>
              <Pagination count={mobilePages} page={safeMobilePage} onChange={(_, page) => setMobilePage(page)} color="primary" size="small" />
            </Stack>
          ) : null}
        </Box>
      </Paper>
    </Box>
  );
}

function MetricCard({ label, value, hint, icon, tone }: { label: string; value: number; hint: string; icon: React.ReactNode; tone: "navy" | "green" | "amber" | "red" }) {
  const tones = {
    navy: { bg: "linear-gradient(145deg,#17365D,#315783)", iconBg: "rgba(255,255,255,.13)" },
    green: { bg: "linear-gradient(145deg,#087F66,#16A085)", iconBg: "rgba(255,255,255,.13)" },
    amber: { bg: "linear-gradient(145deg,#C66A08,#E69522)", iconBg: "rgba(255,255,255,.14)" },
    red: { bg: "linear-gradient(145deg,#B83D4F,#D65A68)", iconBg: "rgba(255,255,255,.14)" },
  }[tone];
  return (
    <Box sx={{ color: "white", borderRadius: 3, p: { xs: 1.4, sm: 1.6 }, background: tones.bg, boxShadow: "0 12px 28px rgba(23,54,93,.12)", minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
        <Box minWidth={0}>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,.72)", textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</Typography>
          <Typography sx={{ mt: .4, fontFamily: "var(--font-display)", fontSize: { xs: 24, sm: 28 }, lineHeight: 1, fontWeight: 800 }}>{value}</Typography>
        </Box>
        <Box sx={{ width: 34, height: 34, borderRadius: 2.2, display: "grid", placeItems: "center", bgcolor: tones.iconBg, flexShrink: 0 }}>{icon}</Box>
      </Stack>
      <Typography variant="caption" sx={{ display: "block", mt: 1.1, color: "rgba(255,255,255,.76)" }}>{hint}</Typography>
    </Box>
  );
}

function TabLabel({ label, count }: { label: string; count: number }) {
  return <Stack direction="row" spacing={.7} alignItems="center"><span>{label}</span><Chip label={count} size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: .75 } }} /></Stack>;
}

function MobilePolicyCard({ policy, canEdit }: { policy: ExternalPolicyViewRow; canEdit: boolean }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.7, borderColor: "#DCE5EF", boxShadow: "0 8px 24px rgba(23,54,93,.055)" }}>
      <Stack direction="row" justifyContent="space-between" spacing={1.2} alignItems="flex-start">
        <Box minWidth={0}>
          <Typography variant="body1" noWrap sx={{ fontWeight: 900 }}>{policy.policy_no}</Typography>
          <Typography variant="caption" noWrap color="text.secondary">{policy.insurance_companies?.name ?? "Insurer not set"}</Typography>
        </Box>
        <PolicyStatus status={policy.status} />
      </Stack>
      <Box sx={{ display: "grid", gap: 1, mt: 1.4 }}>
        <InfoRow label="Customer" value={policy.customers?.contact_name ?? "Customer not linked"} />
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <InfoRow label="Vehicle" value={policy.vehicles?.vehicle_no ?? "Vehicle not linked"} />
          <InfoRow label="Validity" value={validityHint(policy.end_date)} />
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1 }}>
          <InfoRow label="IDV" value={formatCurrency(policy.insured_declared_value)} compact />
          <InfoRow label="Premium" value={formatCurrency(policy.premium_amount)} compact />
          <InfoRow label="Claims" value={String(policy.claim_count)} compact />
        </Box>
      </Box>
      {canEdit ? <Button component={Link} href={`/policies/external/${policy.id}/edit`} fullWidth variant="contained" sx={{ mt: 1.4 }}>Open policy</Button> : null}
    </Paper>
  );
}

function InfoRow({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <Box sx={{ minWidth: 0, borderRadius: 2.2, bgcolor: "#F7F9FC", px: compact ? 1 : 1.2, py: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontSize: 9.5, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</Typography>
      <Typography variant="body2" noWrap sx={{ mt: .15, fontWeight: 800 }}>{value}</Typography>
    </Box>
  );
}

function NoPoliciesOverlay() {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ minHeight: 240, p: 3, textAlign: "center" }}>
      <Box sx={{ width: 48, height: 48, borderRadius: 3, display: "grid", placeItems: "center", bgcolor: "#EEF4FF", color: "primary.main" }}><ShieldCheck size={21} /></Box>
      <Typography variant="h6">No matching external policies</Typography>
      <Typography variant="body2" color="text.secondary">Adjust the search, insurer or policy view to broaden the results.</Typography>
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
  return days < 0 ? `${Math.abs(days)} days overdue` : days === 0 ? "Expires today" : `${days} days left`;
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
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatCurrency(value: number | null) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0, style: "currency", currency: "INR" }).format(value);
}
