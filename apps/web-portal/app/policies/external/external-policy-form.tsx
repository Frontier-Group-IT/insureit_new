"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowLeft,
  CalendarDays,
  CarFront,
  CircleDollarSign,
  FileCheck2,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { createExternalPolicy, updateExternalPolicy, type ExternalPolicyPayload } from "./external-policy-actions";
import { ExternalPolicyMuiTheme } from "./mui-demo-theme";

type CustomerOption = {
  id: string;
  label: string;
  phone: string | null;
  vehicles: { id: string; vehicle_no: string; make: string | null; model: string | null }[];
};
type InsurerOption = { id: string; name: string };

export type ExternalPolicyInitialValues = ExternalPolicyPayload & { policyId?: string };

const emptyValues: ExternalPolicyInitialValues = {
  customerId: "",
  vehicleId: "",
  insuranceCompanyId: "",
  policyNo: "",
  policyType: "Commercial comprehensive",
  startDate: "",
  endDate: "",
  premiumAmount: "",
  insuredDeclaredValue: "",
};

const policyTypeOptions = [
  "Commercial comprehensive",
  "Commercial package policy",
  "Third-party liability",
  "Standalone own damage",
  "Goods carrying commercial vehicle",
  "Passenger carrying commercial vehicle",
];

export function ExternalPolicyForm({
  mode,
  customers,
  insurers,
  initialValues,
}: {
  mode: "create" | "edit";
  customers: CustomerOption[];
  insurers: InsurerOption[];
  initialValues?: ExternalPolicyInitialValues;
}) {
  return (
    <ExternalPolicyMuiTheme>
      <ExternalPolicyFormContent mode={mode} customers={customers} insurers={insurers} initialValues={initialValues} />
    </ExternalPolicyMuiTheme>
  );
}

function ExternalPolicyFormContent({
  mode,
  customers,
  insurers,
  initialValues,
}: {
  mode: "create" | "edit";
  customers: CustomerOption[];
  insurers: InsurerOption[];
  initialValues?: ExternalPolicyInitialValues;
}) {
  const router = useRouter();
  const initial = initialValues ?? emptyValues;
  const [values, setValues] = useState<ExternalPolicyInitialValues>(initial);
  const [message, setMessage] = useState("");
  const [snackbar, setSnackbar] = useState("");
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedCustomer = useMemo(() => customers.find((item) => item.id === values.customerId) ?? null, [customers, values.customerId]);
  const vehicles = selectedCustomer?.vehicles ?? [];
  const selectedVehicle = useMemo(() => vehicles.find((item) => item.id === values.vehicleId) ?? null, [vehicles, values.vehicleId]);
  const selectedInsurer = useMemo(() => insurers.find((item) => item.id === values.insuranceCompanyId) ?? null, [insurers, values.insuranceCompanyId]);
  const requiredValues = [values.customerId, values.vehicleId, values.insuranceCompanyId, values.policyNo, values.policyType, values.startDate, values.endDate];
  const completedRequired = requiredValues.filter((value) => value.trim()).length;
  const completion = Math.round((completedRequired / requiredValues.length) * 100);
  const dateError = Boolean(values.startDate && values.endDate && values.endDate < values.startDate);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);
  const activeStep = !values.customerId || !values.vehicleId
    ? 0
    : !values.insuranceCompanyId || !values.policyNo.trim() || !values.policyType.trim()
      ? 1
      : !values.startDate || !values.endDate || dateError
        ? 2
        : 3;

  function set<K extends keyof ExternalPolicyPayload>(key: K, value: ExternalPolicyPayload[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (message) setMessage("");
  }

  function changeCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId);
    const nextVehicleId = customer?.vehicles.some((vehicle) => vehicle.id === values.vehicleId) ? values.vehicleId : "";
    setValues((current) => ({ ...current, customerId, vehicleId: nextVehicleId }));
    if (message) setMessage("");
  }

  function validateClient() {
    if (!values.customerId) return "Select the customer whose external cover is being recorded.";
    if (!values.vehicleId) return "Select an existing vehicle linked to the customer.";
    if (!values.insuranceCompanyId) return "Select the insurance company.";
    if (!values.policyNo.trim()) return "Enter the policy number.";
    if (!values.policyType.trim()) return "Enter or select the policy type.";
    if (!values.startDate || !values.endDate) return "Enter both policy validity dates.";
    if (values.endDate < values.startDate) return "Policy end date cannot be before the start date.";
    return "";
  }

  function submit() {
    setMessage("");
    const clientError = validateClient();
    if (clientError) {
      setMessage(clientError);
      setSnackbar(clientError);
      return;
    }
    const payload: ExternalPolicyPayload = {
      customerId: values.customerId,
      vehicleId: values.vehicleId,
      insuranceCompanyId: values.insuranceCompanyId,
      policyNo: values.policyNo,
      policyType: values.policyType,
      startDate: values.startDate,
      endDate: values.endDate,
      premiumAmount: values.premiumAmount,
      insuredDeclaredValue: values.insuredDeclaredValue,
    };
    startTransition(async () => {
      const result = mode === "edit" && values.policyId
        ? await updateExternalPolicy(values.policyId, payload)
        : await createExternalPolicy(payload);
      if (!result.ok) {
        setMessage(result.error);
        setSnackbar(result.error);
        return;
      }
      window.location.href = "/policies/external";
    });
  }

  function requestExit() {
    if (dirty) {
      setLeaveOpen(true);
      return;
    }
    router.push("/policies/external");
  }

  return (
    <Box sx={{ mx: "auto", maxWidth: 1260, pb: 2 }}>
      <Paper
        variant="outlined"
        sx={{
          position: "relative",
          overflow: "hidden",
          borderColor: "#D9E3F0",
          background: "linear-gradient(125deg,#FFFFFF 0%,#F7F7FF 60%,#EEF7FF 100%)",
          boxShadow: "0 20px 55px rgba(23,54,93,.08)",
        }}
      >
        <Box sx={{ position: "absolute", width: 250, height: 250, borderRadius: "50%", right: -80, top: -135, bgcolor: "rgba(99,91,255,.09)", filter: "blur(18px)" }} />
        <Box sx={{ position: "relative", p: { xs: 2, sm: 2.5, lg: 3 } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between">
            <Stack direction="row" spacing={1.6} alignItems="flex-start">
              <Box sx={{ width: 50, height: 50, borderRadius: 3, display: "grid", placeItems: "center", flexShrink: 0, color: "white", background: "linear-gradient(145deg,#17365D,#635BFF)", boxShadow: "0 14px 30px rgba(56,64,160,.22)" }}>
                <ShieldCheck size={22} />
              </Box>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="h4">{mode === "edit" ? "Edit External Policy" : "Add External Policy"}</Typography>
                  <Chip label="External record" size="small" color="secondary" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: .7, maxWidth: 700 }}>
                  Record insurance cover purchased outside Sankalp while keeping the policy linked to the correct customer and vehicle for servicing and claims.
                </Typography>
              </Box>
            </Stack>
            <Button onClick={requestExit} variant="outlined" color="primary" startIcon={<ArrowLeft size={16} />} sx={{ alignSelf: { xs: "stretch", md: "center" } }}>
              External Policies
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
            <Chip size="small" label="Customer-linked" variant="outlined" />
            <Chip size="small" label="Vehicle-linked" variant="outlined" />
            <Chip size="small" label="Available for claims" variant="outlined" color="info" />
            <Chip size="small" label="Excluded from SIBL production" variant="outlined" color="warning" />
          </Stack>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ mt: 1.5, px: { xs: 1.5, sm: 2.5 }, py: 2, borderColor: "#DCE5EF", boxShadow: "0 8px 24px rgba(23,54,93,.05)" }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ "& .MuiStepLabel-label": { mt: .7, fontSize: 11, fontWeight: 800 }, "& .MuiStepIcon-root.Mui-active": { color: "secondary.main" }, "& .MuiStepIcon-root.Mui-completed": { color: "success.main" } }}>
          {[
            ["Relationship", "Customer + vehicle"],
            ["Policy identity", "Insurer + policy"],
            ["Coverage", "Dates + values"],
          ].map(([label, hint]) => (
            <Step key={label}>
              <StepLabel optional={<Typography variant="caption" color="text.secondary">{hint}</Typography>}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {message ? <Alert severity="error" variant="filled" sx={{ mt: 1.5, borderRadius: 3 }}>{message}</Alert> : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0,1fr) 330px" }, gap: 1.5, mt: 1.5, alignItems: "start" }}>
        <Stack spacing={1.5}>
          <FormSection
            icon={<UserRound size={18} />}
            number="01"
            title="Link the policy"
            description="Choose the existing customer and the exact vehicle covered by this external policy."
          >
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
              <Autocomplete
                options={customers}
                value={selectedCustomer}
                onChange={(_, customer) => changeCustomer(customer?.id ?? "")}
                getOptionLabel={(option) => `${option.label}${option.phone ? ` • ${option.phone}` : ""}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required
                    label="Customer"
                    placeholder="Search customer name, company or mobile"
                    helperText={selectedCustomer?.phone ? `Mobile: ${selectedCustomer.phone}` : "Only customers accessible to your role are listed"}
                  />
                )}
              />

              <Autocomplete
                options={vehicles}
                value={selectedVehicle}
                disabled={!selectedCustomer}
                onChange={(_, vehicle) => set("vehicleId", vehicle?.id ?? "")}
                getOptionLabel={(vehicle) => `${vehicle.vehicle_no}${[vehicle.make, vehicle.model].filter(Boolean).length ? ` • ${[vehicle.make, vehicle.model].filter(Boolean).join(" ")}` : ""}`}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required
                    label="Existing vehicle"
                    placeholder={selectedCustomer ? "Search registration number" : "Select customer first"}
                    helperText={selectedCustomer ? `${vehicles.length} vehicle${vehicles.length === 1 ? "" : "s"} linked to this customer` : "Vehicle choices are customer-specific"}
                  />
                )}
              />
            </Box>
          </FormSection>

          <FormSection
            icon={<FileCheck2 size={18} />}
            number="02"
            title="Policy identity"
            description="Capture the insurer, exact policy number and policy category shown on the external policy document."
          >
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 1.5 }}>
              <Autocomplete
                options={insurers}
                value={selectedInsurer}
                onChange={(_, insurerOption) => set("insuranceCompanyId", insurerOption?.id ?? "")}
                getOptionLabel={(option) => option.name}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => <TextField {...params} required label="Insurance company" placeholder="Search insurer" helperText="Active insurers from the Insurance Company master" />}
              />

              <TextField
                required
                label="Policy number"
                value={values.policyNo}
                onChange={(event) => set("policyNo", event.target.value.toUpperCase())}
                placeholder="Enter policy number"
                helperText="Stored in uppercase for consistent search and matching"
              />

              <Box sx={{ gridColumn: { md: "1 / -1" } }}>
                <Autocomplete
                  freeSolo
                  options={policyTypeOptions}
                  value={values.policyType}
                  onChange={(_, value) => set("policyType", typeof value === "string" ? value : values.policyType)}
                  onInputChange={(_, value) => set("policyType", value)}
                  renderInput={(params) => <TextField {...params} required label="Policy type" placeholder="Select or type policy type" helperText="Suggested commercial policy types are provided, but custom policy text is allowed" />}
                />
              </Box>
            </Box>
          </FormSection>

          <FormSection
            icon={<CalendarDays size={18} />}
            number="03"
            title="Coverage and value"
            description="Enter the validity period and optional financial values used for service and claim context."
          >
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
              <TextField
                required
                type="date"
                label="Valid from"
                value={values.startDate}
                onChange={(event) => set("startDate", event.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                required
                type="date"
                label="Valid upto"
                value={values.endDate}
                onChange={(event) => set("endDate", event.target.value)}
                error={dateError}
                helperText={dateError ? "End date must be on or after the start date" : "Policy expiry date"}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Premium amount"
                value={values.premiumAmount}
                onChange={(event) => set("premiumAmount", sanitizeMoney(event.target.value))}
                placeholder="0.00"
                helperText="Optional"
                slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> }, htmlInput: { inputMode: "decimal" } }}
              />
              <TextField
                label="Insured Declared Value (IDV)"
                value={values.insuredDeclaredValue}
                onChange={(event) => set("insuredDeclaredValue", sanitizeMoney(event.target.value))}
                placeholder="0.00"
                helperText="Optional"
                slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> }, htmlInput: { inputMode: "decimal" } }}
              />
            </Box>
          </FormSection>
        </Stack>

        <Paper variant="outlined" sx={{ position: { lg: "sticky" }, top: { lg: 86 }, overflow: "hidden", borderColor: "#DCE5EF", boxShadow: "0 14px 38px rgba(23,54,93,.07)" }}>
          <Box sx={{ p: 2, color: "white", background: "linear-gradient(135deg,#17365D,#315783)" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Box>
                <Typography variant="caption" sx={{ color: "rgba(255,255,255,.68)", textTransform: "uppercase", letterSpacing: ".08em" }}>Live review</Typography>
                <Typography variant="h6" sx={{ color: "white", mt: .25 }}>Coverage snapshot</Typography>
              </Box>
              <Tooltip title={`${completion}% of required fields complete`}>
                <Chip label={`${completion}%`} size="small" sx={{ bgcolor: "rgba(255,255,255,.14)", color: "white", border: "1px solid rgba(255,255,255,.18)" }} />
              </Tooltip>
            </Stack>
            <LinearProgress variant="determinate" value={completion} sx={{ mt: 1.4, height: 6, borderRadius: 999, bgcolor: "rgba(255,255,255,.15)", "& .MuiLinearProgress-bar": { bgcolor: "#63E6BE", borderRadius: 999 } }} />
          </Box>

          <Stack spacing={0} divider={<Divider flexItem />}>
            <SummaryBlock icon={<UserRound size={16} />} label="Customer" value={selectedCustomer?.label ?? "Not selected"} secondary={selectedCustomer?.phone ?? undefined} />
            <SummaryBlock icon={<CarFront size={16} />} label="Vehicle" value={selectedVehicle?.vehicle_no ?? "Not selected"} secondary={selectedVehicle ? [selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(" ") || undefined : undefined} />
            <SummaryBlock icon={<ShieldCheck size={16} />} label="Insurer" value={selectedInsurer?.name ?? "Not selected"} secondary={values.policyNo || undefined} />
            <SummaryBlock icon={<CalendarDays size={16} />} label="Validity" value={values.startDate && values.endDate ? `${formatDate(values.startDate)} – ${formatDate(values.endDate)}` : "Dates not complete"} secondary={dateError ? "Check date sequence" : undefined} tone={dateError ? "error" : "default"} />
            <SummaryBlock icon={<CircleDollarSign size={16} />} label="Financials" value={`Premium ${formatMoneyPreview(values.premiumAmount)}`} secondary={`IDV ${formatMoneyPreview(values.insuredDeclaredValue)}`} />
          </Stack>

          <Box sx={{ p: 1.5 }}>
            <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2.5, "& .MuiAlert-message": { fontSize: 11.5, lineHeight: 1.55 } }}>
              This policy stays outside SIBL production calculations even after it is saved.
            </Alert>
          </Box>
        </Paper>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          position: "sticky",
          bottom: 10,
          zIndex: 20,
          mt: 1.5,
          p: 1.25,
          borderColor: "#D7E1EC",
          bgcolor: "rgba(255,255,255,.94)",
          backdropFilter: "blur(18px)",
          boxShadow: "0 14px 42px rgba(23,54,93,.13)",
        }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip size="small" color={completion === 100 && !dateError ? "success" : "default"} label={completion === 100 && !dateError ? "Ready to save" : `${completedRequired} of ${requiredValues.length} required fields`} />
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>Server-side access and relationship checks still run when you save.</Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button onClick={requestExit} variant="outlined" color="inherit" sx={{ flex: { xs: 1, sm: "0 0 auto" } }}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={isPending}
              variant="contained"
              color="primary"
              startIcon={isPending ? <CircularProgress size={15} color="inherit" /> : <Save size={16} />}
              sx={{ flex: { xs: 2, sm: "0 0 auto" }, minWidth: 170 }}
            >
              {isPending ? "Saving policy…" : mode === "edit" ? "Save changes" : "Add external policy"}
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Discard unsaved changes?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">You have changed this external policy form. Leaving now will discard those unsaved values.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setLeaveOpen(false)} color="inherit" variant="outlined">Keep editing</Button>
          <Button onClick={() => router.push("/policies/external")} color="error" variant="contained">Discard and leave</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={5000} onClose={() => setSnackbar("")} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert severity="error" variant="filled" onClose={() => setSnackbar("")} sx={{ width: "100%", borderRadius: 3 }}>{snackbar}</Alert>
      </Snackbar>
    </Box>
  );
}

function FormSection({ icon, number, title, description, children }: { icon: React.ReactNode; number: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ overflow: "hidden", borderColor: "#DCE5EF", boxShadow: "0 10px 30px rgba(23,54,93,.055)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, px: { xs: 1.5, sm: 2 }, py: 1.4, borderBottom: "1px solid", borderColor: "divider", bgcolor: "#FBFCFE" }}>
        <Box sx={{ width: 38, height: 38, borderRadius: 2.5, display: "grid", placeItems: "center", bgcolor: "#17365D", color: "white", flexShrink: 0 }}>{icon}</Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" sx={{ color: "secondary.main", fontWeight: 900 }}>{number}</Typography>
            <Typography variant="h6">{title}</Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">{description}</Typography>
        </Box>
      </Box>
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>{children}</Box>
    </Paper>
  );
}

function SummaryBlock({ icon, label, value, secondary, tone = "default" }: { icon: React.ReactNode; label: string; value: string; secondary?: string; tone?: "default" | "error" }) {
  return (
    <Stack direction="row" spacing={1.2} sx={{ p: 1.6 }} alignItems="flex-start">
      <Box sx={{ width: 34, height: 34, borderRadius: 2.2, display: "grid", placeItems: "center", bgcolor: tone === "error" ? "#FEF2F2" : "#F1F5FB", color: tone === "error" ? "error.main" : "primary.main", flexShrink: 0 }}>{icon}</Box>
      <Box minWidth={0}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</Typography>
        <Typography variant="body2" noWrap sx={{ mt: .15, fontWeight: 900, color: tone === "error" ? "error.main" : "text.primary" }}>{value}</Typography>
        {secondary ? <Typography variant="caption" noWrap color={tone === "error" ? "error.main" : "text.secondary"} sx={{ display: "block", mt: .15 }}>{secondary}</Typography> : null}
      </Box>
    </Stack>
  );
}

function sanitizeMoney(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}

function formatMoneyPreview(value: string) {
  const parsed = Number(value);
  if (!value.trim() || !Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(parsed);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
