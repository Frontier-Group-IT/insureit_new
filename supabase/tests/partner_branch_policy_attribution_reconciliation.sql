-- SQL regression for staged Branch->parent association. Read-only; must return zero violations.
-- Run AFTER applying canonical hierarchy migrations in a test database.
WITH expected AS (
  SELECT p.id policy_id,b.id branch_id,parent.id parent_partner_id
  FROM public.policies p
  JOIN public.partners legacy ON legacy.partner_code=p.intermediary_code
  JOIN public.partner_branch_profiles old ON old.partner_id=legacy.id
  JOIN public.partner_branches b ON b.legacy_branch_profile_id=old.id
  JOIN public.partners parent ON parent.id=b.parent_partner_id
),
missing_or_wrong AS (
  SELECT e.policy_id FROM expected e
  LEFT JOIN public.partner_branch_policy_links l ON l.policy_id=e.policy_id
  WHERE l.policy_id IS NULL OR l.branch_id<>e.branch_id OR l.parent_partner_id<>e.parent_partner_id
),
duplicate_attribution AS (
  SELECT policy_id FROM public.partner_branch_policy_links
  GROUP BY policy_id HAVING count(*)<>1
),
orphan_links AS (
  SELECT l.policy_id FROM public.partner_branch_policy_links l
  LEFT JOIN public.partner_branches b ON b.id=l.branch_id
  WHERE b.id IS NULL OR b.parent_partner_id IS DISTINCT FROM l.parent_partner_id
)
SELECT (SELECT count(*) FROM expected) expected_historical_branch_policies,
       (SELECT count(*) FROM missing_or_wrong) missing_or_wrong_count,
       (SELECT count(*) FROM duplicate_attribution) duplicate_policy_count,
       (SELECT count(*) FROM orphan_links) orphan_link_count;
