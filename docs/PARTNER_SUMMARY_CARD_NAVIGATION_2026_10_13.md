# Partner Policy and Claims summary card navigation — 2026-10-13

On the Partner Expo app Policies and Claims screens, each KPI tile under search now uses an accessible Pressable. Clicking a tile clears search, resets incremental list size, and selects the corresponding existing authorized filter. Policies: All, Active (in_force), Expiring (expiring), Lapsed (expired). Claims: All, Settled (completed), In Progress (active). The Rejected Claims metric has no backed count or supported `partner_app_list_claims` rejected filter, so tapping it opens All claims with an explicit notice instead of mislabeling another list as rejected.

No SQL/RLS/auth modifications and no APK/AAB/OTA. Confirm tap targets, selected tabs, clearing search, and filtered results on device prior to publication. Full rejected-only filtering requires a separately reviewed backend query and reliable count semantics.
