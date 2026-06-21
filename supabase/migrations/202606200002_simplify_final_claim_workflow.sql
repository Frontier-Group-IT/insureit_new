-- Simplified post-final-surveyor workflow for the claim desk.
alter type public.claim_status add value if not exists 'Repair Done';
alter type public.claim_status add value if not exists 'Claim Completion In Progress';