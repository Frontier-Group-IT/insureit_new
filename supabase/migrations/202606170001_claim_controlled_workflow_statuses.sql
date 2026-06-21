alter type public.claim_status add value if not exists 'Initial Documents Pending';
alter type public.claim_status add value if not exists 'Initial Documents Submitted';
alter type public.claim_status add value if not exists 'Initial Documents Verified';
alter type public.claim_status add value if not exists 'Final Documents Awaited';
alter type public.claim_status add value if not exists 'Final Documents Submitted';
alter type public.claim_status add value if not exists 'Final Documents Verified';
alter type public.claim_status add value if not exists 'DO Submitted';
