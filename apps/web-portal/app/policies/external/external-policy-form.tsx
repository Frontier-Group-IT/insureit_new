"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowLeft, Save } from "lucide-react";
import { createExternalPolicy, updateExternalPolicy, type ExternalPolicyPayload } from "./external-policy-actions";
import { ExternalPolicyMuiTheme } from "./mui-demo-theme";

type VehicleOption = {
  id: string;
  vehicle_no: string;
  make: string | null;
  model: string | null;
  vehicle_type: string | null;
};

type CustomerOption = {
  id: string;
  label: string;
  phone: string | null;
  vehicles: VehicleOption[];
};
type InsurerOption = { id: string; name: string };

export type ExternalPolicyInitialValues = ExternalPolicyPayload & { policyId?: string };

const emptyValues: ExternalPolicyInitialValues = {
  customerId: "",
  vehicleId: "",
  insuranceCompanyId: "",
  policyNo: "",
  policyType: "",
  startDate: "",
  endDate: "",
  premiumAmount: "",
  insuredDeclaredValue: "",
};

const standardPolicyProducts = ["Package", "Third Party", "SAOD"];
const privateVehiclePolicyProducts = [
  "Package",
  "Third Party",
  "SAOD",
  "Bundled",
  "Long Term Package",
  "Long Term Third Party",
];

function policyProductsForVehicleType(vehicleType: string | null | undefined) {
  const code = (vehicleType ?? "").trim().toUpperCase();
  if (!code) return [];
  return code === "PCP" || code === "TWP" ? privateVehiclePolicyProducts : standardPolicyProducts;
}

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
  const policyProductOptions = useMemo(() => {
    const options = policyProductsForVehicleType(selectedVehicle?.vehicle_type);
    if (mode === "edit" && values.policyType && !options.includes(values.policyType)) return [values.policyType, ...options];
    return options;
  }, [mode, selectedVehicle?.vehicle_type, values.policyType]);
  const dateError = Boolean(values.startDate && values.endDate && values.endDate < values.startDate);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  function set<K extends keyof ExternalPolicyPayload>(key: K, value: ExternalPolicyPayload[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    if (message) setMessage("");
  }

  function changeCustomer(customerId: string) {
    const customer = customers.find((item) => item.id === customerId);
    setValues((current) => {
      const nextVehicle = customer?.vehicles.find((vehicle) => vehicle.id === current.vehicleId) ?? null;
      const allowedProducts = policyProductsForVehicleType(nextVehicle?.vehicle_type);
      return {
        ...current,
        customerId,
        vehicleId: nextVehicle?.id ?? "",
        policyType: nextVehicle && allowedProducts.includes(current.policyType) ? current.policyType : "",
      };
    });
    if (message) setMessage("");
  }

  function changeVehicle(vehicle: VehicleOption | null) {
    const allowedProducts = policyProductsForVehicleType(vehicle?.vehicle_type);
    setValues((current) => ({
      ...current,
      vehicleId: vehicle?.id ?? "",
      policyType: vehicle && allowedProducts.includes(current.policyType) ? current.policyType : "",
    }));
    if (message) setMessage("");
  }

  function validateClient() {
    if (!values.customerId) return "Select a customer.";
    if (!values.vehicleId) return "Select a vehicle.";
    if (!values.insuranceCompanyId) return "Select an insurance company.";
    if (!values.policyNo.trim()) return "Enter the policy number.";
    if (!values.policyType.trim()) return "Select the policy product.";
    if (!values.startDate || !values.endDate) return "Enter both validity dates.";
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
    <Box sx={{ mx: "auto", maxWidth: 1180, pb: 1 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button onClick={requestExit} variant="text" color="inherit" startIcon={<ArrowLeft size={16} />} sx={{ px: .75, minWidth: 0 }}>
            Back
          </Button>
          <Divider orientation="vertical" flexItem sx={{ my: .6 }} />
          <Typography variant="h5">{mode === "edit" ? "Edit External Policy" : "Add External Policy"}</Typography>
        </Stack>
        <Stack direction="row" spacing={.8}>
          <Button onClick={requestExit} variant="outlined" color="inherit" sx={{ flex: { xs: 1, sm: "0 0 auto" } }}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPending}
            variant="contained"
            startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : <Save size={15} />}
            sx={{ flex: { xs: 1.4, sm: "0 0 auto" }, minWidth: { sm: 138 } }}
          >
            {isPending ? "Saving…" : mode === "edit" ? "Save Changes" : "Save Policy"}
          </Button>
        </Stack>
      </Stack>

      {message ? <Alert severity="error" sx={{ mb: 1, py: .15 }}>{message}</Alert> : null}

      <Paper variant="outlined" sx={{ borderColor: "#DCE5EF", overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,.035)" }}>
        <CompactSection title="Policy Linkage">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3,minmax(0,1fr))" }, gap: 1.25 }}>
            <Autocomplete
              size="small"
              options={customers}
              value={selectedCustomer}
              onChange={(_, customer) => changeCustomer(customer?.id ?? "")}
              getOptionLabel={(option) => `${option.label}${option.phone ? ` • ${option.phone}` : ""}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} required label="Customer" placeholder="Search customer" />}
            />

            <Autocomplete
              size="small"
              options={vehicles}
              value={selectedVehicle}
              disabled={!selectedCustomer}
              onChange={(_, vehicle) => changeVehicle(vehicle)}
              getOptionLabel={(vehicle) => `${vehicle.vehicle_no}${[vehicle.make, vehicle.model].filter(Boolean).length ? ` • ${[vehicle.make, vehicle.model].filter(Boolean).join(" ")}` : ""}`}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} required label="Vehicle" placeholder={selectedCustomer ? "Search vehicle" : "Select customer first"} />}
            />

            <Autocomplete
              size="small"
              options={insurers}
              value={selectedInsurer}
              onChange={(_, insurerOption) => set("insuranceCompanyId", insurerOption?.id ?? "")}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} required label="Insurance Company" placeholder="Search insurer" />}
            />
          </Box>
        </CompactSection>

        <Divider />

        <CompactSection title="Policy Details">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "minmax(0,.9fr) minmax(0,1.4fr)" }, gap: 1.25 }}>
            <TextField
              size="small"
              required
              label="Policy Number"
              value={values.policyNo}
              onChange={(event) => set("policyNo", event.target.value.toUpperCase())}
              placeholder="Policy number"
            />

            <Autocomplete
              size="small"
              options={policyProductOptions}
              value={values.policyType || null}
              disabled={!selectedVehicle}
              onChange={(_, value) => set("policyType", value ?? "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  label="Policy Product"
                  placeholder={selectedVehicle ? "Select product" : "Select vehicle first"}
                />
              )}
            />
          </Box>
        </CompactSection>

        <Divider />

        <CompactSection title="Coverage">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }, gap: 1.25 }}>
            <TextField
              size="small"
              required
              type="date"
              label="Valid From"
              value={values.startDate}
              onChange={(event) => set("startDate", event.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              required
              type="date"
              label="Valid Upto"
              value={values.endDate}
              onChange={(event) => set("endDate", event.target.value)}
              error={dateError}
              helperText={dateError ? "End date must be after start date" : undefined}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              size="small"
              label="Premium"
              value={values.premiumAmount}
              onChange={(event) => set("premiumAmount", sanitizeMoney(event.target.value))}
              placeholder="0"
              slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> }, htmlInput: { inputMode: "decimal" } }}
            />
            <TextField
              size="small"
              label="IDV"
              value={values.insuredDeclaredValue}
              onChange={(event) => set("insuredDeclaredValue", sanitizeMoney(event.target.value))}
              placeholder="0"
              slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> }, htmlInput: { inputMode: "decimal" } }}
            />
          </Box>
        </CompactSection>
      </Paper>

      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Discard changes?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">Unsaved changes will be lost.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.25 }}>
          <Button onClick={() => setLeaveOpen(false)} color="inherit" variant="outlined">Keep Editing</Button>
          <Button onClick={() => router.push("/policies/external")} color="error" variant="contained">Discard</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snackbar)} autoHideDuration={4500} onClose={() => setSnackbar("")} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert severity="error" variant="filled" onClose={() => setSnackbar("")} sx={{ width: "100%" }}>{snackbar}</Alert>
      </Snackbar>
    </Box>
  );
}

function CompactSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ px: { xs: 1.5, sm: 2 }, py: { xs: 1.5, sm: 1.75 } }}>
      <Typography variant="caption" sx={{ display: "block", mb: 1, color: "#44546A", fontWeight: 900, textTransform: "uppercase", letterSpacing: ".055em" }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function sanitizeMoney(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}
