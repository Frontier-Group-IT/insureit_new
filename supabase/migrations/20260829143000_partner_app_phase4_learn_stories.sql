begin;

create table if not exists public.partner_learning_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  category text not null,
  prompt text not null,
  options jsonb not null,
  correct_option_key text not null,
  explanation text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  active_from date,
  active_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_learning_cards_options_array check (jsonb_typeof(options) = 'array'),
  constraint partner_learning_cards_active_range check (active_to is null or active_from is null or active_to >= active_from)
);

create table if not exists public.partner_learning_attempts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.partner_learning_cards(id) on delete cascade,
  selected_option_key text not null,
  is_correct boolean not null,
  attempted_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique(auth_user_id, card_id, attempted_on)
);

alter table public.partner_learning_cards enable row level security;
alter table public.partner_learning_attempts enable row level security;

revoke all on table public.partner_learning_cards from public, anon, authenticated;
revoke all on table public.partner_learning_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.partner_learning_cards to service_role;
grant select, insert, update, delete on table public.partner_learning_attempts to service_role;

create index if not exists partner_learning_cards_active_idx
  on public.partner_learning_cards(is_active, sort_order, code);

create index if not exists partner_learning_attempts_user_day_idx
  on public.partner_learning_attempts(auth_user_id, attempted_on desc);

insert into public.partner_learning_cards(
  code, category, prompt, options, correct_option_key, explanation, sort_order
)
values
(
  'MOTOR-IDV-001',
  'Motor basics',
  'In a Motor policy, what does IDV primarily represent?',
  '[
    {"key":"a","label":"The insured value used for total-loss or theft assessment, subject to policy terms"},
    {"key":"b","label":"The insurer claim number"},
    {"key":"c","label":"The GST charged on premium"},
    {"key":"d","label":"The garage repair estimate"}
  ]'::jsonb,
  'a',
  'IDV is the insured declared value of the vehicle used for total-loss or theft assessment, subject to the issued policy terms.',
  10
),
(
  'RENEWAL-EARLY-001',
  'Renewals',
  'A customer policy is approaching expiry. What is the strongest first step?',
  '[
    {"key":"a","label":"Wait until the policy expires"},
    {"key":"b","label":"Contact the customer early and confirm renewal requirements"},
    {"key":"c","label":"Open a claim immediately"},
    {"key":"d","label":"Change the insurer without speaking to the customer"}
  ]'::jsonb,
  'b',
  'Early contact gives time to confirm requirements, resolve document gaps and avoid a last-minute renewal rush.',
  20
),
(
  'POLICY-SOURCE-001',
  'Policy servicing',
  'Which source should you rely on for the exact coverage and terms of an issued policy?',
  '[
    {"key":"a","label":"A verbal summary from memory"},
    {"key":"b","label":"A social-media post"},
    {"key":"c","label":"The issued policy schedule and policy wording"},
    {"key":"d","label":"A previous customer policy"}
  ]'::jsonb,
  'c',
  'The issued policy schedule and wording are the authoritative references for that customer policy.',
  30
),
(
  'CLAIM-UPDATE-001',
  'Claims',
  'Before telling a customer that a claim status has changed, what should you do first?',
  '[
    {"key":"a","label":"Verify the latest recorded claim status"},
    {"key":"b","label":"Guess the likely next stage"},
    {"key":"c","label":"Promise a settlement date"},
    {"key":"d","label":"Ignore the claim record"}
  ]'::jsonb,
  'a',
  'Verify the latest recorded status first. Clear, accurate updates are better than assumptions about the next claim stage.',
  40
),
(
  'VEHICLE-LINK-001',
  'Customer servicing',
  'Why is the vehicle number especially useful during Motor policy servicing?',
  '[
    {"key":"a","label":"It helps link the customer, vehicle and relevant policy record"},
    {"key":"b","label":"It replaces the policy wording"},
    {"key":"c","label":"It guarantees claim approval"},
    {"key":"d","label":"It determines the insurer automatically"}
  ]'::jsonb,
  'a',
  'The vehicle number is a practical identifier for finding the right vehicle and related Motor policy. It does not replace policy terms or insurer decisions.',
  50
),
(
  'OCR-REVIEW-001',
  'Policy Intake',
  'A value extracted from an uploaded policy copy looks clearly wrong. What should happen?',
  '[
    {"key":"a","label":"Submit it without checking"},
    {"key":"b","label":"Guess a replacement value"},
    {"key":"c","label":"Review the source document and clarify or correct it through the controlled workflow"},
    {"key":"d","label":"Delete the policy copy"}
  ]'::jsonb,
  'c',
  'Extracted data should be checked against the source document. Uncertain values should be clarified through the controlled review process rather than guessed.',
  60
),
(
  'TP-FOCUS-001',
  'Motor basics',
  'A Third Party Motor policy primarily focuses on which risk?',
  '[
    {"key":"a","label":"Liability toward third parties, subject to the policy and applicable law"},
    {"key":"b","label":"Every own-damage repair to the insured vehicle"},
    {"key":"c","label":"Vehicle servicing cost"},
    {"key":"d","label":"Fuel expenses"}
  ]'::jsonb,
  'a',
  'Third Party Motor cover primarily addresses third-party liability. Exact coverage always follows the issued policy and applicable law.',
  70
),
(
  'INTAKE-CLEAR-COPY-001',
  'Policy Intake',
  'Operations asks for a clearer policy copy. What is the best response?',
  '[
    {"key":"a","label":"Upload a clearer original copy of the same policy"},
    {"key":"b","label":"Manually invent unreadable values"},
    {"key":"c","label":"Upload an unrelated policy"},
    {"key":"d","label":"Ignore the request"}
  ]'::jsonb,
  'a',
  'A clearer original copy preserves source accuracy and lets Operations complete the policy review safely.',
  80
)
on conflict (code) do update
set
  category=excluded.category,
  prompt=excluded.prompt,
  options=excluded.options,
  correct_option_key=excluded.correct_option_key,
  explanation=excluded.explanation,
  sort_order=excluded.sort_order,
  is_active=true,
  updated_at=now();

create or replace function public.partner_app_learning_today()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_identity jsonb;
  v_card public.partner_learning_cards%rowtype;
  v_attempt public.partner_learning_attempts%rowtype;
  v_card_count integer;
  v_index integer;
  v_total_days integer := 0;
  v_total_attempts integer := 0;
  v_correct_answers integer := 0;
  v_streak integer := 0;
  v_anchor date;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  v_identity := public.partner_app_current_identity();
  if v_identity is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select count(*)::int
  into v_card_count
  from public.partner_learning_cards c
  where c.is_active
    and (c.active_from is null or c.active_from <= current_date)
    and (c.active_to is null or c.active_to >= current_date);

  if v_card_count = 0 then
    return jsonb_build_object(
      'available', false,
      'generated_at', now(),
      'stats', jsonb_build_object(
        'attempted_days', 0,
        'total_attempts', 0,
        'correct_answers', 0,
        'current_streak', 0
      )
    );
  end if;

  v_index := mod(extract(doy from current_date)::int - 1, v_card_count);

  select c.*
  into v_card
  from public.partner_learning_cards c
  where c.is_active
    and (c.active_from is null or c.active_from <= current_date)
    and (c.active_to is null or c.active_to >= current_date)
  order by c.sort_order, c.code
  offset v_index
  limit 1;

  select a.*
  into v_attempt
  from public.partner_learning_attempts a
  where a.auth_user_id = v_uid
    and a.card_id = v_card.id
    and a.attempted_on = current_date
  limit 1;

  select
    count(distinct attempted_on)::int,
    count(*)::int,
    count(*) filter(where is_correct)::int
  into v_total_days, v_total_attempts, v_correct_answers
  from public.partner_learning_attempts
  where auth_user_id = v_uid;

  select max(attempted_on)
  into v_anchor
  from public.partner_learning_attempts
  where auth_user_id = v_uid
    and attempted_on >= current_date - 1;

  if v_anchor is not null then
    with days as (
      select distinct attempted_on
      from public.partner_learning_attempts
      where auth_user_id = v_uid
        and attempted_on <= v_anchor
    ),
    ranked as (
      select attempted_on,
             row_number() over(order by attempted_on desc) as rn
      from days
    )
    select count(*)::int
    into v_streak
    from ranked
    where attempted_on = v_anchor - ((rn - 1)::int);
  end if;

  return jsonb_build_object(
    'available', true,
    'generated_at', now(),
    'card', jsonb_build_object(
      'id', v_card.id,
      'code', v_card.code,
      'category', v_card.category,
      'prompt', v_card.prompt,
      'options', v_card.options
    ),
    'answered_today', v_attempt.id is not null,
    'answer',
      case
        when v_attempt.id is null then null
        else jsonb_build_object(
          'selected_option_key', v_attempt.selected_option_key,
          'is_correct', v_attempt.is_correct,
          'correct_option_key', v_card.correct_option_key,
          'explanation', v_card.explanation
        )
      end,
    'stats', jsonb_build_object(
      'attempted_days', v_total_days,
      'total_attempts', v_total_attempts,
      'correct_answers', v_correct_answers,
      'current_streak', v_streak
    )
  );
end;
$$;

create or replace function public.partner_app_submit_learning_answer(
  p_card_id uuid,
  p_selected_option_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_identity jsonb;
  v_today jsonb;
  v_today_card_id uuid;
  v_card public.partner_learning_cards%rowtype;
  v_attempt public.partner_learning_attempts%rowtype;
  v_is_correct boolean;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  v_identity := public.partner_app_current_identity();
  if v_identity is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_today := public.partner_app_learning_today();
  if coalesce((v_today->>'available')::boolean,false) = false then
    raise exception 'No learning card is available today';
  end if;

  v_today_card_id := (v_today->'card'->>'id')::uuid;
  if p_card_id is null or p_card_id <> v_today_card_id then
    raise exception 'This learning card is not active for today';
  end if;

  select *
  into v_card
  from public.partner_learning_cards
  where id = p_card_id
    and is_active
    and (active_from is null or active_from <= current_date)
    and (active_to is null or active_to >= current_date);

  if not found then
    raise exception 'Learning card not found';
  end if;

  if nullif(btrim(coalesce(p_selected_option_key,'')),'') is null
     or not exists (
       select 1
       from jsonb_array_elements(v_card.options) opt
       where opt->>'key' = p_selected_option_key
     ) then
    raise exception 'Invalid learning option';
  end if;

  select *
  into v_attempt
  from public.partner_learning_attempts
  where auth_user_id=v_uid
    and card_id=p_card_id
    and attempted_on=current_date
  for update;

  if not found then
    v_is_correct := p_selected_option_key = v_card.correct_option_key;

    insert into public.partner_learning_attempts(
      auth_user_id, card_id, selected_option_key, is_correct, attempted_on
    )
    values(
      v_uid, p_card_id, p_selected_option_key, v_is_correct, current_date
    )
    returning * into v_attempt;
  end if;

  return jsonb_build_object(
    'selected_option_key', v_attempt.selected_option_key,
    'is_correct', v_attempt.is_correct,
    'correct_option_key', v_card.correct_option_key,
    'explanation', v_card.explanation,
    'today', public.partner_app_learning_today()
  );
end;
$$;

create or replace function public.partner_app_stories()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_home jsonb;
  v_impact jsonb;
  v_journey jsonb;
  v_business jsonb;
  v_learning jsonb;
  v_items jsonb := '[]'::jsonb;
  v_priority jsonb;
  v_next jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  if public.partner_app_current_identity() is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_home := public.partner_app_home();
  v_impact := public.partner_app_impact();
  v_journey := public.partner_app_journey();
  v_business := public.partner_app_business_performance();
  v_learning := public.partner_app_learning_today();

  v_priority := coalesce(v_home->'today'->0, null);
  v_next := v_journey->'next_milestone';

  if v_priority is not null then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kind','today',
      'eyebrow','TODAY',
      'title',v_priority->>'title',
      'body',v_priority->>'subtitle',
      'route',v_priority->>'route',
      'tone','attention'
    ));
  else
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kind','today',
      'eyebrow','TODAY',
      'title','You are clear for now',
      'body','No urgent renewal, claim or Policy Intake action is waiting.',
      'route','/pulse',
      'tone','calm'
    ));
  end if;

  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'kind','impact',
    'eyebrow','YOUR IMPACT',
    'title',(v_impact->>'active_vehicles') || ' vehicles currently covered',
    'body',(v_impact->>'customers_served') || ' customers served · ' || (v_impact->>'claims_assisted') || ' claims assisted',
    'metric',v_impact->'active_motor_idv',
    'metric_label','active Motor IDV',
    'route','/impact',
    'tone','impact'
  ));

  if v_next is not null then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kind','journey',
      'eyebrow','MY JOURNEY',
      'title',(v_next->>'remaining') || ' customers to ' || (v_next->>'title'),
      'body','Your next milestone is based on real recorded customer progress.',
      'progress_current',v_next->'current',
      'progress_target',v_next->'target',
      'route','/journey',
      'tone','journey'
    ));
  end if;

  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'kind','business',
    'eyebrow','THIS MONTH',
    'title',(v_business->>'policies_this_month') || ' policies recorded',
    'body','Gross premium ' || trim(to_char((v_business->>'premium_this_month')::numeric,'FM₹999999999990D00')),
    'metric',v_business->'premium_this_month',
    'metric_label','gross premium',
    'route','/(tabs)/business',
    'tone','business'
  ));

  if coalesce((v_learning->>'available')::boolean,false) then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kind','learn',
      'eyebrow','60 SEC LEARN',
      'title',v_learning->'card'->>'category',
      'body',v_learning->'card'->>'prompt',
      'route','/learn',
      'tone','learn',
      'answered_today',v_learning->'answered_today'
    ));
  end if;

  return jsonb_build_object(
    'generated_at',now(),
    'items',v_items
  );
end;
$$;

revoke all on function public.partner_app_learning_today() from public, anon;
revoke all on function public.partner_app_submit_learning_answer(uuid,text) from public, anon;
revoke all on function public.partner_app_stories() from public, anon;

grant execute on function public.partner_app_learning_today() to authenticated, service_role;
grant execute on function public.partner_app_submit_learning_answer(uuid,text) to authenticated, service_role;
grant execute on function public.partner_app_stories() to authenticated, service_role;

commit;
