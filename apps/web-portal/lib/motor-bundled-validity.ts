export function motorBundledExpiry(from: string, years: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return "";
  const [year, month, day] = from.split("-").map(Number);
  const date = new Date(Date.UTC(year + years, month - 1, day));
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function isBundledMotorCover(vehicleClass: string | null | undefined, product: string | null | undefined): boolean {
  return ["TWP", "PCP"].includes((vehicleClass ?? "").trim().toUpperCase()) && (product ?? "").trim().toLowerCase() === "bundled";
}
