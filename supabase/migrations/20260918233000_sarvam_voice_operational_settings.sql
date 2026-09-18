-- Persist the Sarvam renewal calling window so IT Super User can update it
-- from the production Voice Integration control center without a redeploy.

create table if not exists public.sarvam_voice_operational_settings (
  id text primary key,
  window_start time without time zone not null,
  window_end time without time zone not null,
  time_zone text not null default 'Asia/Kolkata',
  updated_by_auth_user_id uuid null,
  updated_at timestamptz not null default now(),
  constraint sarvam_voice_operational_settings_nonzero_window
    check (window_start <> window_end)
);

alter table public.sarvam_voice_operational_settings enable row level security;

revoke all on table public.sarvam_voice_operational_settings from anon, authenticated;
grant all on table public.sarvam_voice_operational_settings to service_role;

insert into public.sarvam_voice_operational_settings (
  id,
  window_start,
  window_end,
  time_zone
)
values (
  'production',
  time '09:00',
  time '18:00',
  'Asia/Kolkata'
)
on conflict (id) do nothing;

comment on table public.sarvam_voice_operational_settings is
  'IT-controlled server-only operational settings for Sarvam renewal calling.';
