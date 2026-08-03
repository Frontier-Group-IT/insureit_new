import type { ReactNode } from "react";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { hasCapability } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { AccountDeleteControl } from "./account-delete-control";
import { IibPanVerificationReviewCard } from "./iib-pan-verification-review-card";
import { ReviewCardVisibility } from "./review-card-visibility";

type ApplicationRow = {
  id: string;
  draft_data: Record<string, unknown> | null;
  partner_record_id: string | null;
};

type ProfileRow = {
  partner_id: string | null;
  external_onboarding_id: string | null;
};

type IntermediaryRow = {
  intermediary_code: string | null;
};

export default async function ApplicationReviewLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const reviewer = await requireScopedPospMispManager(id);
  const canDelete = hasCapability(reviewer.role, "manage_system");
  const admin = createSupabaseAdminClient();

  const [{ data: application }, { data: profile }, { data: intermediary }] = await Promise.all([
    admin
      .from("intermediary_onboarding_applications")
      .select("id,draft_data,partner_record_id")
      .eq("id", id)
      .maybeSingle<ApplicationRow>(),
    admin
      .from("posp_misp_onboarding_profiles")
      .select("partner_id,external_onboarding_id")
      .eq("application_id", id)
      .maybeSingle<ProfileRow>(),
    admin
      .from("intermediaries")
      .select("intermediary_code")
      .eq("application_id", id)
      .maybeSingle<IntermediaryRow>(),
  ]);

  if (!application || !profile) return children;

  const rawContext = application.draft_data?.account_context;
  const accountContext = rawContext === "posp" || rawContext === "misp" ? rawContext : "partner";
  const accountIdentifier = accountContext === "partner"
    ? permanentValue(profile.partner_id)
    : permanentValue(intermediary?.intermediary_code) ?? permanentValue(profile.external_onboarding_id);

  let linkedAccountCount = 0;
  if (canDelete && accountContext === "partner") {
    if (application.partner_record_id) {
      const { count } = await admin
        .from("intermediary_onboarding_applications")
        .select("id", { count: "exact", head: true })
        .eq("partner_record_id", application.partner_record_id)
        .neq("id", id);
      linkedAccountCount = count ?? 0;
    } else {
      const { count } = await admin
        .from("intermediary_onboarding_applications")
        .select("id", { count: "exact", head: true })
        .contains("draft_data", { parent_partner_application_id: id });
      linkedAccountCount = count ?? 0;
    }
  }

  return (
    <>
      {children}
      <ReviewCardVisibility applicationId={id}>
        <IibPanVerificationReviewCard applicationId={id} />
      </ReviewCardVisibility>
      {canDelete ? (
        <AccountDeleteControl
          applicationId={id}
          accountContext={accountContext}
          accountIdentifier={accountIdentifier}
          linkedAccountCount={linkedAccountCount}
        />
      ) : null}
    </>
  );
}

function permanentValue(value: string | null | undefined) {
  if (!value || value.startsWith("PENDING-")) return null;
  return value;
}
