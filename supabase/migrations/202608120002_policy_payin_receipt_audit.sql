alter table public.policy_payin_bills
  add column if not exists receipt_reference text,
  add column if not exists received_by uuid references public.profiles(id) on delete set null;

create index if not exists policy_payin_bills_received_by_idx
  on public.policy_payin_bills(received_by);
