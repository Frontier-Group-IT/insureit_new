update public.policy_payin_bills
set status = 'Billed', updated_at = now()
where status = 'Received';
