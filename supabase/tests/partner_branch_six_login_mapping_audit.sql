-- Read-only verification of every active legacy Branch identity against canonical
-- policy association. This does NOT impersonate authenticated users or test RPCs.
WITH identities AS (
 SELECT a.profile_id, b.id AS branch_id, b.parent_partner_id
 FROM public.portal_access_identities a
 JOIN public.partner_branch_profiles old ON old.partner_id=a.entity_id
 JOIN public.partner_branches b ON b.legacy_branch_profile_id=old.id
 WHERE a.entity_type='branch' AND a.status='active'
), visible AS (
 SELECT i.profile_id, i.branch_id, l.policy_id
 FROM identities i
 JOIN public.partner_branch_policy_links l ON l.branch_id=i.branch_id
), breaches AS (
 SELECT v.profile_id,v.policy_id
 FROM visible v
 JOIN public.partner_branch_policy_links l ON l.policy_id=v.policy_id
 WHERE v.branch_id<>l.branch_id
), misparents AS (
 SELECT l.policy_id FROM public.partner_branch_policy_links l
 JOIN public.partner_branches b ON b.id=l.branch_id
 WHERE l.parent_partner_id IS DISTINCT FROM b.parent_partner_id
)
SELECT (SELECT count(*) FROM identities) active_legacy_branch_logins,
       (SELECT count(*) FROM visible) scoped_policy_pairs,
       (SELECT count(*) FROM breaches) cross_branch_mapping_violations,
       (SELECT count(*) FROM misparents) incorrect_parent_mappings;
-- Release requires both violation fields = 0.
-- An authenticated end-to-end test with separate real test sessions is STILL required.
