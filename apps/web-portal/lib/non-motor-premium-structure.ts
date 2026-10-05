import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  normalizeNonMotorProductKey,
  type NonMotorPremiumStructure,
  type NonMotorProductConfiguration,
} from "@/lib/non-motor-premium-structure-shared";

export type { NonMotorPremiumStructure, NonMotorProductConfiguration } from "@/lib/non-motor-premium-structure-shared";

type ConfigurationRow = {
  product_name: string;
  product_key: string;
  premium_structure: string;
};

export async function loadNonMotorProductConfigurations(): Promise<NonMotorProductConfiguration[]> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("non_motor_product_configurations")
    .select("product_name,product_key,premium_structure")
    .eq("is_active", true)
    .order("product_name", { ascending: true })
    .returns<ConfigurationRow[]>();

  if (error) throw new Error(`Unable to load Non-Motor product premium structures: ${error.message}`);

  return (data ?? []).map((row) => ({
    productName: row.product_name,
    productKey: row.product_key,
    premiumStructure: row.premium_structure === "od_tp" ? "od_tp" : "standard",
  }));
}

export async function resolveNonMotorPremiumStructure(
  productName: string,
  requestedStructure: NonMotorPremiumStructure,
): Promise<{ ok: true; premiumStructure: NonMotorPremiumStructure } | { ok: false; error: string }> {
  const admin = createSupabaseAdminClient();
  const normalizedName = productName.trim().replace(/\s+/g, " ");
  const productKey = normalizeNonMotorProductKey(normalizedName);
  if (!productKey) return { ok: false, error: "Enter the product or policy name." };

  const { data: existing, error: lookupError } = await admin
    .from("non_motor_product_configurations")
    .select("product_name,product_key,premium_structure")
    .eq("product_key", productKey)
    .eq("is_active", true)
    .maybeSingle<ConfigurationRow>();

  if (lookupError) return { ok: false, error: "Product premium structure could not be verified. Please try again." };

  if (existing) {
    const configuredStructure: NonMotorPremiumStructure = existing.premium_structure === "od_tp" ? "od_tp" : "standard";
    if (configuredStructure !== requestedStructure) {
      return {
        ok: false,
        error: `${existing.product_name} is already configured as ${configuredStructure === "od_tp" ? "OD + TP" : "Standard"}. Use the configured premium structure for this product.`,
      };
    }
    return { ok: true, premiumStructure: configuredStructure };
  }

  const { error: insertError } = await admin.from("non_motor_product_configurations").insert({
    product_name: normalizedName,
    product_key: productKey,
    premium_structure: requestedStructure,
    is_active: true,
  });

  if (insertError) {
    const { data: concurrent, error: concurrentError } = await admin
      .from("non_motor_product_configurations")
      .select("product_name,product_key,premium_structure")
      .eq("product_key", productKey)
      .eq("is_active", true)
      .maybeSingle<ConfigurationRow>();
    if (concurrentError || !concurrent) return { ok: false, error: "Product premium structure could not be saved. Please try again." };
    const configuredStructure: NonMotorPremiumStructure = concurrent.premium_structure === "od_tp" ? "od_tp" : "standard";
    if (configuredStructure !== requestedStructure) {
      return {
        ok: false,
        error: `${concurrent.product_name} is already configured as ${configuredStructure === "od_tp" ? "OD + TP" : "Standard"}. Use the configured premium structure for this product.`,
      };
    }
    return { ok: true, premiumStructure: configuredStructure };
  }

  return { ok: true, premiumStructure: requestedStructure };
}
