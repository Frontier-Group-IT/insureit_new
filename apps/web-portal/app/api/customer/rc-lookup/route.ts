import { NextResponse } from "next/server";

import { getAuthenticatedProfile } from "@/lib/auth";
import { lookupAuthbridgeRc, normalizeVehicleRegistrationNumber } from "@/lib/authbridge-rc-api";

export const dynamic = "force-dynamic";

type SafeVehicleDetails = {
  registrationNumber: string;
  registrationDate: string | null;
  manufacturer: string | null;
  model: string | null;
  manufacturingYear: string | null;
  vehicleClass: string | null;
  fuelType: string | null;
  gvwKg: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  fitnessExpiryDate: string | null;
  pucExpiryDate: string | null;
  roadTaxExpiryDate: string | null;
  nationalPermitExpiryDate: string | null;
  localPermitExpiryDate: string | null;
};

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "").trim();
  const auth = await getAuthenticatedProfile(accessToken);
  if (!auth.user || !auth.profile?.is_active || auth.profile.role !== "customer") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { registrationNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const registrationNumber = normalizeVehicleRegistrationNumber(body.registrationNumber ?? "");
  if (!registrationNumber) {
    return NextResponse.json({ error: "Enter a valid RC number." }, { status: 400 });
  }

  try {
    const result = await lookupAuthbridgeRc(registrationNumber);
    const details = sanitizeVehicleResponse(result.data, registrationNumber);
    const mappedCount = Object.entries(details).filter(([key, value]) => key !== "registrationNumber" && Boolean(value)).length;

    if (!mappedCount) {
      return NextResponse.json(
        {
          error: "Vehicle details were returned but could not be matched safely. Please enter the details manually.",
          registrationNumber,
          transactionId: result.transactionId ?? null,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      status: "success",
      provider: "authbridge",
      transactionId: result.transactionId ?? null,
      lookedUpAt: result.lookedUpAt ?? null,
      details,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vehicle lookup failed.";
    console.warn("customer_rc_lookup_failed", {
      user_id: auth.user.id,
      registration_number: registrationNumber,
      reason: safeReason(message),
    });
    return NextResponse.json({ error: customerMessage(message) }, { status: 502 });
  }
}

function sanitizeVehicleResponse(raw: unknown, registrationNumber: string): SafeVehicleDetails {
  const values = flattenPrimitiveValues(raw);
  return {
    registrationNumber,
    registrationDate: toIsoDate(findValue(values, ["registrationdate", "regdate", "dateofregistration"])),
    manufacturer: cleanText(findValue(values, ["manufacturer", "manufacturername", "maker", "makername", "vehiclemanufacturer"])),
    model: cleanText(findValue(values, ["model", "modelname", "makermodel", "vehiclename", "vehiclemodel"])),
    manufacturingYear: toYear(findValue(values, ["manufacturingyear", "manufactureyear", "mfgyear", "yearofmanufacture", "manufacturingdate", "manufacturedate"])),
    vehicleClass: mapVehicleClass(cleanText(findValue(values, ["vehicleclass", "vehicleclassdesc", "classofvehicle", "vehiclecategory", "vehicletype"]))),
    fuelType: mapFuel(cleanText(findValue(values, ["fueltype", "fuel", "fueldescription"]))),
    gvwKg: cleanNumber(findValue(values, ["gvw", "gvwkg", "grossvehicleweight", "grossweight"])),
    chassisNumber: cleanCode(findValue(values, ["chassisnumber", "chassisno", "chassis"])),
    engineNumber: cleanCode(findValue(values, ["enginenumber", "engineno", "engine"])),
    fitnessExpiryDate: toIsoDate(findValue(values, ["fitnessexpirydate", "fitnessupto", "fitnessvalidupto", "fitnessvalidity"])),
    pucExpiryDate: toIsoDate(findValue(values, ["pucexpirydate", "puccupto", "pucupto", "pucvalidupto", "pollutionupto"])),
    roadTaxExpiryDate: toIsoDate(findValue(values, ["roadtaxexpirydate", "taxupto", "taxvalidupto", "roadtaxupto"])),
    nationalPermitExpiryDate: toIsoDate(findValue(values, ["nationalpermitexpirydate", "nationalpermitupto", "nationalpermitvalidupto"])),
    localPermitExpiryDate: toIsoDate(findValue(values, ["localpermitexpirydate", "localpermitupto", "localpermitvalidupto"])),
  };
}

function flattenPrimitiveValues(value: unknown, prefix = "", output = new Map<string, string>(), depth = 0) {
  if (depth > 8 || value == null) return output;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (prefix) output.set(normalizeKey(prefix), String(value));
    return output;
  }
  if (Array.isArray(value)) {
    value.slice(0, 20).forEach((item, index) => flattenPrimitiveValues(item, `${prefix}${index}`, output, depth + 1));
    return output;
  }
  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      flattenPrimitiveValues(nested, key, output, depth + 1);
    }
  }
  return output;
}

function findValue(values: Map<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = values.get(normalizeKey(key));
    if (value && value.trim() && !/^null|undefined|na|n\/a$/i.test(value.trim())) return value.trim();
  }
  return null;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanText(value: string | null) {
  if (!value) return null;
  const next = value.replace(/\s+/g, " ").trim();
  return next && next.length <= 120 ? next : null;
}

function cleanCode(value: string | null) {
  if (!value) return null;
  const next = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!next || /[*X]{4,}/.test(next)) return null;
  return next.slice(0, 80);
}

function cleanNumber(value: string | null) {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match?.[0] ?? null;
}

function toYear(value: string | null) {
  if (!value) return null;
  const match = value.match(/(?:19|20)\d{2}/);
  return match?.[0] ?? null;
}

function toIsoDate(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  let match = trimmed.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if (match) return validIso(match[1], match[2], match[3]);
  match = trimmed.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (match) return validIso(match[3], match[2], match[1]);
  return null;
}

function validIso(year: string, month: string, day: string) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const parsed = new Date(y, m - 1, d);
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function mapFuel(value: string | null) {
  if (!value) return null;
  const fuel = value.toLowerCase();
  if (fuel.includes("diesel")) return "Diesel";
  if (fuel.includes("petrol")) return "Petrol";
  if (fuel.includes("cng")) return "CNG";
  if (fuel.includes("electric")) return "Electric";
  if (fuel.includes("hybrid")) return "Hybrid";
  if (fuel.includes("bi") && fuel.includes("fuel")) return "Bi-Fuel";
  return "Other";
}

function mapVehicleClass(value: string | null) {
  if (!value) return null;
  const text = value.toLowerCase();
  if (/(two.?wheeler|motor.?cycle|scooter)/.test(text)) return "TWP";
  if (/(private.?car|motor.?car)/.test(text)) return "PCP";
  if (/(goods|truck|lorry|goods.?carrier)/.test(text)) return "GCV";
  if (/(passenger|bus|taxi|cab|maxi)/.test(text)) return "PCV";
  if (/(construction|plant|machinery|excavator|crane)/.test(text)) return "CPM";
  return "MISD";
}

function customerMessage(message: string) {
  const lower = message.toLowerCase();
  if (lower.includes("valid vehicle registration")) return "Enter a valid RC number.";
  if (lower.includes("timed out") || lower.includes("timeout")) return "Vehicle details are taking longer than usual. Please try again.";
  if (lower.includes("not configured") || lower.includes("unauthorized")) return "Vehicle lookup is temporarily unavailable. You can continue manually.";
  return "We could not fetch the vehicle details. You can continue manually.";
}

function safeReason(message: string) {
  return message.replace(/[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{1,4}/gi, "[rc]").slice(0, 160);
}
