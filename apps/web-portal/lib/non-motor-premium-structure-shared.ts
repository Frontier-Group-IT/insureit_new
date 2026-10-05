export type NonMotorPremiumStructure = "standard" | "od_tp";

export type NonMotorProductConfiguration = {
  productName: string;
  productKey: string;
  premiumStructure: NonMotorPremiumStructure;
};

export function normalizeNonMotorProductKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}
