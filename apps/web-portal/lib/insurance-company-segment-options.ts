import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type InsuranceCompanySegment = "general" | "life" | "health";
export type InsuranceCompanySegmentOption = {
  value: string;
  label: string;
  segment: InsuranceCompanySegment;
};

export const getActiveInsuranceCompanySegmentOptions = unstable_cache(
  async (): Promise<InsuranceCompanySegmentOption[]> => {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("insurance_companies")
      .select("id,name,segment")
      .eq("is_active", true)
      .in("segment", ["general", "life", "health"])
      .order("name", { ascending: true })
      .returns<Array<{ id: string; name: string; segment: InsuranceCompanySegment }>>();
    if (error) throw error;
    return (data ?? []).map((insurer) => ({
      value: insurer.id,
      label: insurer.name,
      segment: insurer.segment,
    }));
  },
  ["reference-active-insurance-company-segment-options"],
  { revalidate: 300, tags: ["reference:insurance-companies"] },
);
