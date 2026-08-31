export function formatIndianCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const hasPaise = Math.abs(safeAmount % 1) > Number.EPSILON;

  return `₹${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(safeAmount)}`;
}
