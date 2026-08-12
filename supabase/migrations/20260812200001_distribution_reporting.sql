-- Distribution reporting was introduced in the live project with this migration version.
-- The function definition was immediately corrected for canonical RM attribution in
-- 20260812200534_fix_distribution_reporting_rm_assignment.sql. That follow-up migration
-- contains the full replay-safe final definition and privilege lockdown.
select 1;
