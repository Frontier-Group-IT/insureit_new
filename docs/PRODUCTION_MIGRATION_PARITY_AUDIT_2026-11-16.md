# INSUREIT production migration-history reconciliation — 2026-11-16

**Status: Audit only; no changes made to production data or migration ledger.**

## Evidence

- Production project: `ilzhsfqqjyppzzvfscmh` (Insureit_Web).
- 541 SQL migration filenames were present in the repository directory.
- 564 migration entries were returned from production Supabase.
- 83 repository migration versions at or after 20261008183000 were absent by exact version.
- 72 have at least one same-base-name entry under another version (**possible aliases, not validated equivalent SQL**).
- 11 did not have a same-base-name entry; requires schema/object-by-object investigation.

## Potential timestamp aliases (not approved for repair)

| Repository migration | Production migration candidate(s) |
|---|---|
| `20261008183000_partner_register_business_metrics.sql` | `20261010095142_partner_register_business_metrics` |
| `20261009130000_partner_customer_external_claim_links.sql` | `20261009073849_partner_customer_external_claim_links` |
| `20261013124500_partner_app_top_insurers.sql` | `20261013071748_partner_app_top_insurers` |
| `20261014130500_admin_hard_delete_preflight.sql` | `20261014100640_admin_hard_delete_preflight_20261014` |
| `20261014142000_admin_hard_delete_cascade_guards.sql` | `20261014100649_admin_hard_delete_cascade_guards_20261014` |
| `20261016130000_partner_account_deletion_requests.sql` | `20261016095930_partner_account_deletion_requests_20261016` |
| `20261016153000_partner_deletion_fulfillment_safeguards.sql` | `20261016095937_partner_deletion_fulfillment_safeguards_20261016` |
| `20261017120000_exchange_it_listing_visibility.sql` | `20261017112000_exchange_it_listing_visibility_20261017` |
| `20261017150500_partner_activity_read_receipts.sql` | `20261017093748_partner_activity_read_receipts_20261017` |
| `20261019120000_it_group_safe_delete.sql` | `20261019061638_it_group_safe_delete_20261019` |
| `20261019170000_claims_head_organization_claim_updates.sql` | `20261019120919_claims_head_organization_claim_updates_20261019` |
| `20261019171500_claims_head_shadow_rbac_least_privilege.sql` | `20261019120930_claims_head_shadow_rbac_least_privilege_20261019` |
| `20261019173000_partner_claim_detail_internal_policy_precedence.sql` | `20261019125612_partner_claim_detail_internal_policy_precedence` |
| `20261020101500_partner_app_scoped_payout_range.sql` | `20261020044517_partner_app_scoped_payout_range` |
| `20261020135000_portal_password_recovery_eligibility.sql` | `20261024062732_portal_password_recovery_eligibility` |
| `20261020231000_it_user_operational_compatibility.sql` | `20261020182715_it_user_operational_compatibility_20261020` |
| `20261021100000_partner_app_top_insurers_range.sql` | `20261021044150_partner_app_top_insurers_range` |
| `20261021133000_customer_policyless_claim_intimation.sql` | `20261021075031_customer_policyless_claim_intimation` |
| `20261021155000_partner_app_create_claim.sql` | `20261021093949_partner_app_create_claim` |
| `20261021160000_partner_app_save_claim_spot.sql` | `20261021093958_partner_app_save_claim_spot` |
| `20261021163000_partner_claim_detail_scoped_document_inventory.sql` | `20261021110737_partner_claim_detail_scoped_document_inventory` |
| `20261021170000_motor_policy_add_on_premium.sql` | `20261021120848_motor_policy_add_on_premium` |
| `20261021193000_motor_policy_addon_atomic_save.sql` | `20261021175536_motor_policy_addon_atomic_save` |
| `20261021224000_motor_addon_od_commissions.sql` | `20261021175850_motor_addon_od_commissions` |
| `20261023174500_partner_claim_control_and_scope_permissions.sql` | `20261023123311_partner_claim_control_and_scope_permissions` |
| `20261024122500_partner_claim_vehicle_choices_pagination.sql` | `20261024071718_partner_claim_vehicle_choices_pagination_20261024` |
| `20261024165000_partner_claim_scoped_document_delete.sql` | `20261026045332_partner_claim_scoped_document_delete` |
| `202610270001_partner_policy_intermediary_name.sql` | `20261027062235_partner_policy_intermediary_name`, `20261027062834_partner_policy_intermediary_name_20261027` |
| `20261028143000_partner_insurer_register_scoped_payout.sql` | `20261028095328_partner_insurer_register_scoped_payout` |
| `20261028161000_partner_insurer_employee_payin_retention.sql` | `20261028105137_partner_insurer_employee_payin_retention` |
| `20261028190000_partner_policy_scoped_partner_codes.sql` | `20261029063609_partner_policy_scoped_partner_codes_20261028` |
| `20261028190100_partner_branch_commercial_scope.sql` | `20261029063624_partner_branch_commercial_scope_20261028` |
| `20261029132500_motor_bundled_cover_validity.sql` | `20261029080438_motor_bundled_cover_validity` |
| `20261029145500_motor_partial_tp_cpa_payin.sql` | `20261029094407_motor_partial_tp_cpa_payin` |
| `20261029152500_partner_partial_tp_cpa_payout.sql` | `20261029095716_partner_partial_tp_cpa_payout` |
| `20261029164000_editable_bundled_cover_expiry.sql` | `20261029120205_editable_bundled_cover_expiry` |
| `20261029165000_partner_web_branch_contact_greeting.sql` | `20261030061506_partner_web_branch_contact_greeting` |
| `20261030121500_partner_claim_secure_preview.sql` | `20261030060915_partner_claim_secure_preview` |
| `20261030124000_partner_branch_canonical_identity_phase1.sql` | `20261030080459_partner_branch_canonical_identity_phase1_20261030` |
| `20261030130500_partner_branch_policy_attribution_readonly.sql` | `20261030080505_partner_branch_policy_attribution_readonly_20261030` |
| `20261030142000_canonical_partner_branch_creation_and_auth_foundation.sql` | `20261030080512_canonical_partner_branch_creation_and_auth_foundation_20261030` |
| `20261030162000_partner_branch_policy_parent_links.sql` | `20261030080518_partner_branch_policy_parent_links_20261030` |
| `20261030173000_partner_branch_authorized_policy_ids.sql` | `20261030082354_partner_branch_authorized_policy_ids_20261030` |
| `20261030183500_partner_branch_canonical_portal_identity.sql` | `20261030082357_partner_branch_canonical_portal_identity_20261030` |
| `20261030194000_partner_branch_policy_summary.sql` | `20261030095754_partner_branch_policy_summary_20261030` |
| `20261030202000_partner_branch_linked_customer_claim_renewal_scopes.sql` | `20261030094246_partner_branch_linked_customer_claim_renewal_scopes_20261030` |
| `20261030214500_partner_branch_verified_policyless_claim_ownership.sql` | `20261030095758_partner_branch_verified_policyless_claim_ownership_20261030` |
| `20261031123000_partner_branch_completed_policy_reconciliation.sql` | `20261031065413_partner_branch_completed_policy_reconciliation_20261031` |
| `20261031124000_partner_branch_completed_intake_ownership_trigger.sql` | `20261031065428_partner_branch_completed_intake_ownership_trigger_20261031` |
| `20261031164500_policy_pair_delete_branch_link_cleanup.sql` | `20261031112551_policy_pair_delete_branch_link_cleanup_20261031` |
| `20261102113000_partner_app_branch_policy_list_summary_parity.sql` | `20261102071631_partner_app_branch_policy_list_summary_parity` |
| `20261103110000_life_pension_optional_policy_maturity.sql` | `20261103051236_20261103110000_life_pension_optional_policy_maturity` |
| `20261103114500_policy_issuance_email_otp_approval.sql` | `20261103061455_policy_issuance_email_otp_approval` |
| `20261103160000_vehicle_rc_optional_details.sql` | `20261103064455_vehicle_rc_optional_details` |
| `20261103170000_sync_internal_spot_status_to_customer_milestones.sql` | `20261103120431_sync_internal_spot_status_to_customer_milestones` |
| `20261104100500_partner_register_period_business_metrics.sql` | `20261104051245_partner_register_period_business_metrics` |
| `20261104113000_policy_date_approval_request_context.sql` | `20261104100622_policy_date_approval_request_context` |
| `20261104130000_partner_business_mis_scoped_details.sql` | `20261104072309_partner_business_mis_scoped_details` |
| `20261104170000_customer_claim_all_stage_operations_details.sql` | `20261104114911_customer_claim_all_stage_operations_details` |
| `20261104183000_motor_addon_payin_tds_atomic_consistency.sql` | `20261113105359_motor_addon_payin_tds_atomic_consistency_20261113` |
| `20261104190000_partner_business_export_scope_parity.sql` | `20261104122347_partner_business_export_scope_parity` |
| `20261105170000_self_managed_claim_operations_stage_parity.sql` | `20261105120737_self_managed_claim_operations_stage_parity` |
| `20261105180000_preserve_external_claim_management_mode.sql` | `20261107071017_preserve_external_claim_management_mode` |
| `20261107133000_partner_policy_intake_search_text.sql` | `20261107070205_partner_policy_intake_search_text` |
| `20261107180000_partner_app_website_write_permission_guards.sql` | `20261107120521_partner_app_website_write_permission_guards` |
| `20261110112500_finance_report_rm_employee_id_alignment.sql` | `20261110051956_finance_report_rm_employee_id_alignment` |
| `20261111121500_partner_activity_claim_vehicle_manufacturer.sql` | `20261111063729_partner_activity_claim_vehicle_manufacturer` |
| `20261111173000_partner_insurer_register_commercial_authorization.sql` | `20261111115942_partner_insurer_register_commercial_authorization` |
| `20261111184500_partner_claim_external_financial_milestones.sql` | `20261111125404_partner_claim_external_financial_milestones` |
| `20261112100000_life_health_optional_policy_maturity.sql` | `20261112094931_life_health_optional_policy_maturity` |
| `20261113055000_partner_policy_intake_web_handoff_tickets.sql` | `20261113060659_partner_policy_intake_web_handoff_tickets` |
| `20261113111500_employee_source_identity_booked_rm_history.sql` | `20261113124647_employee_source_identity_booked_rm_history_20261113` |

## Migrations without a matching name

- `20261020131500_rm_service_enquiry_ownership.sql`
- `20261020230500_add_it_user_role.sql`
- `20261022162000_partner_claim_operations_parity.sql`
- `20261022162500_partner_claim_detail_editable_values.sql`
- `20261022163000_customer_policyless_claim_draft_insert_rls.sql`
- `20261023101500_operations_head_life_role.sql`
- `20261023160000_partner_claim_upload_scope_execute.sql`
- `20261030110000_partner_branch_policy_detail_scope.sql`
- `20261030231500_partner_branch_central_scope_cutover.sql`
- `20261104101500_partner_register_mtd_net_premium.sql`
- `20261104165000_customer_spot_draft_sync.sql`

## Required safe repair sequence

1. For each pair, compare the exact repository migration SQL to the actual production tables, columns, functions, policies, triggers, privileges and effects; name equality is not proof of application.
2. For unmatched versions, identify renamed/combined migrations and prove each effect. Preserve function signatures and permission/role grants; do not infer application from a later timestamp.
3. Record evidence for each migration, reviewer, SQL fingerprint/object checks, and a backup of the original migration ledger before proposing repairs.
4. Only for proven equivalent versions, prepare a separately reviewed, reversible ledger-only reconciliation; genuinely absent effects need dedicated reviewed schema migrations, not a fake ledger entry.
5. Run `.github/workflows/deploy-production.yml` **without disabling the migration parity or Partner RPC gates**, then verify Vercel deployment is READY and live authenticated `/api/partner/life-health-cases` POST and `/api/partner/policy-intakes/native-onboarding/sources` behavior.
6. Publish the native Partner App production OTA only after the backend is live and permissions/negative-role checks pass.

## Deployment consequence

The case-editing PR #4599 is merged but the website production deploy fails the schema-parity gate. Its production OTA also failed a separate release-review gate for a changed Partner test script; no confirmed live native editing.

**Do not execute blanket `supabase migration repair` or insert all missing versions into `supabase_migrations.schema_migrations`.**

## Read-only production schema spot-check (2026-11-16)

The following **exact objects** were queried in `Insureit_Web`, without modifying database state:

| Expected object | Found? | Corresponding repository migration |
|---|---|---|
| enum `app_role.it_user` | Yes | `20261020230500_add_it_user_role.sql` |
| enum `app_role.operations_head_life` | Yes | `20261023101500_operations_head_life_role.sql` |
| function `partner_app_save_claim_stage(uuid,text,jsonb,boolean)` | Yes | `20261022162000_partner_claim_operations_parity.sql` |
| function `partner_app_claim_detail(uuid)` | Yes | `20261022162500_partner_claim_detail_editable_values.sql` |
| function `partner_app_claim_in_scope(uuid)` | Yes | `20261030231500_partner_branch_central_scope_cutover.sql` |
| function `partner_app_policy_in_scope(uuid)` | Yes | `20261030110000_partner_branch_policy_detail_scope.sql` |
| function `partner_register_mtd_net_premium(uuid[])` | **No** | `20261104101500_partner_register_mtd_net_premium.sql` |
| table `claim_spot_intimation_drafts` | **No** | `20261104165000_customer_spot_draft_sync.sql` |
| policy `claims.customer_policyless_claim_draft_insert` | **No** | `20261022163000_customer_policyless_claim_draft_insert_rls.sql` |
| index `service_enquiries_assigned_to_created_idx` | **No** | `20261020131500_rm_service_enquiry_ownership.sql` |

The scan for alternative similarly named tables/functions/policies/indexes returned no matches for those four absent objects. **An existing function/enum alone is not evidence that its full migration (including grants/RLS/triggers) was applied.** Conversely, absent objects provide evidence that a blanket migration-ledger repair would be unsafe. The actual schema effects of every migration must be verified before any marking applied.

Production application is blocked until those missing schema effects are handled through separately reviewed, idempotent, schema-first migrations, and the complete ledger reconciliation is proven. Do **not** insert version-only records for these four absent objects.

## Applied SQL vs repository SQL comparison — completed

The production migration ledger stores original SQL in `supabase_migrations.schema_migrations.statements`. The SQL text of each of the **72 same-name alias candidates** was compared directly against the matching repository file, without mutating the database.

- **68 matched exactly** after trimming outer whitespace. These are high-confidence migration timestamp aliases, eligible for separately reviewed ledger-only reconciliation with a reversible backup/restore plan.
- **4 were not byte-for-byte identical**, and must not be silently treated as applied:
  - `20261009130000_partner_customer_external_claim_links.sql` vs production `20261009073849`: leading comments and SQL text length differ; review functional equivalence.
  - `20261019173000_partner_claim_detail_internal_policy_precedence.sql` vs production `20261019125612`: semicolon difference at the close of a PL/pgSQL body; verify syntax/signature.
  - `20261024165000_partner_claim_scoped_document_delete.sql` vs production `20261026045332`: leading comments / length differ; review executable SQL equivalence.
  - `20261105170000_self_managed_claim_operations_stage_parity.sql` vs production `20261105120737`: substantive trigger-function arity guard difference; **do not alias automatically**.
- **11 have no same-name migration entry**. An additional read-only exact-SQL search across the production ledger found **no identical statement text** for those 11. Some expected schema elements are present, but at least four exact objects are absent (see the preceding spot-check).

This corrects the earlier name-only assessment. **No `migration repair`, database DDL, ledger insert/update/delete, CI bypass, or production deploy has been executed as part of this audit.**
