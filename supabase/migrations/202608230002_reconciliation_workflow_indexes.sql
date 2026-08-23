create index if not exists reconciliation_cycles_created_by_idx on public.reconciliation_cycles(created_by);
create index if not exists reconciliation_cycles_reviewed_by_idx on public.reconciliation_cycles(reviewed_by) where reviewed_by is not null;
create index if not exists reconciliation_cycles_closed_by_idx on public.reconciliation_cycles(closed_by) where closed_by is not null;
create index if not exists reconciliation_cycles_reopened_by_idx on public.reconciliation_cycles(reopened_by) where reopened_by is not null;
create index if not exists reconciliation_lines_reviewed_by_idx on public.reconciliation_lines(reviewed_by) where reviewed_by is not null;
create index if not exists reconciliation_events_line_idx on public.reconciliation_events(line_id) where line_id is not null;
create index if not exists reconciliation_events_actor_idx on public.reconciliation_events(actor_profile_id);
