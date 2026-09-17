create or replace function public.post_accounts_excel_reconciliation(
  p_actor uuid,
  p_invoice_groups jsonb,
  p_receipt_groups jsonb,
  p_payout_groups jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group jsonb;
  v_line jsonb;
  v_alloc jsonb;
  v_invoice_id uuid;
  v_payable_id uuid;
  v_existing uuid;
  v_total numeric(14,2);
  v_tds numeric(14,2);
  v_allocations jsonb;
  v_count_invoices integer := 0;
  v_count_receipts integer := 0;
  v_count_tds integer := 0;
  v_count_payments integer := 0;
  v_status text;
begin
  if p_actor is null then raise exception 'Actor is required'; end if;
  if jsonb_typeof(coalesce(p_invoice_groups,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_receipt_groups,'[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_payout_groups,'[]'::jsonb)) <> 'array' then
    raise exception 'Invalid import payload';
  end if;

  -- Create each insurer bill once. The whole RPC is one transaction, so any later
  -- validation/posting error rolls the complete import back.
  for v_group in select * from jsonb_array_elements(coalesce(p_invoice_groups,'[]'::jsonb)) loop
    if nullif(btrim(v_group->>'billNumber'),'') is null
       or nullif(v_group->>'billDate','') is null
       or nullif(v_group->>'insurerId','') is null then
      raise exception 'Insurer, bill number and bill date are required';
    end if;

    select id into v_existing
    from public.accounts_invoices
    where insurer_id=(v_group->>'insurerId')::uuid
      and lower(coalesce(invoice_no,''))=lower(btrim(v_group->>'billNumber'))
      and status <> 'Cancelled'
    limit 1;
    if v_existing is not null then
      raise exception 'Bill % already exists for this insurer', v_group->>'billNumber';
    end if;

    select round(coalesce(sum((x->>'billAmount')::numeric),0),2)
      into v_total
    from jsonb_array_elements(coalesce(v_group->'lines','[]'::jsonb)) x;
    if v_total <= 0 then raise exception 'Bill total must be positive'; end if;

    insert into public.accounts_invoices(
      insurer_id, invoice_no, invoice_date, status,
      brokerage_subtotal, tax_amount, gross_invoice_amount, outstanding_amount,
      tax_treatment, notes, created_by, raised_by, raised_at
    ) values (
      (v_group->>'insurerId')::uuid,
      btrim(v_group->>'billNumber'),
      (v_group->>'billDate')::date,
      'Raised', v_total, 0, v_total, v_total,
      'Excel reconciliation', 'Created from Accounts Excel reconciliation import',
      p_actor, p_actor, now()
    ) returning id into v_invoice_id;

    for v_line in select * from jsonb_array_elements(coalesce(v_group->'lines','[]'::jsonb)) loop
      if coalesce((v_line->>'billAmount')::numeric,0) <= 0 then raise exception 'Bill line amount must be positive'; end if;
      insert into public.accounts_invoice_lines(
        invoice_id, policy_id, policy_no, line_type,
        recognized_brokerage_amount, adjustment_amount, invoice_line_amount, description
      ) values (
        v_invoice_id,
        (v_line->>'policyId')::uuid,
        nullif(v_line->>'policyNumber',''),
        'Brokerage',
        round(coalesce((v_line->>'projectedPayin')::numeric,0),2),
        round(coalesce((v_line->>'billAmount')::numeric,0)-coalesce((v_line->>'projectedPayin')::numeric,0),2),
        round((v_line->>'billAmount')::numeric,2),
        'Accounts Excel reconciliation line'
      );
    end loop;

    insert into public.accounts_receivable_entries(
      insurer_id, invoice_id, entry_date, entry_type, document_reference,
      debit_amount, credit_amount, description, created_by
    ) values (
      (v_group->>'insurerId')::uuid, v_invoice_id, (v_group->>'billDate')::date,
      'Invoice', btrim(v_group->>'billNumber'), v_total, 0,
      'Brokerage bill raised from Accounts Excel reconciliation', p_actor
    );
    insert into public.accounts_invoice_events(
      invoice_id,event_type,to_status,event_data,actor_profile_id
    ) values (
      v_invoice_id,'Invoice imported and raised','Raised',
      jsonb_build_object('source','accounts_excel_reconciliation','gross_invoice_amount',v_total),p_actor
    );
    v_count_invoices := v_count_invoices + 1;

    v_tds := round(coalesce((v_group->>'actualTds')::numeric,0),2);
    if v_tds > 0 then
      perform public.post_accounts_tds(
        v_invoice_id,
        coalesce(nullif(v_group->>'tdsDate','')::date,(v_group->>'billDate')::date),
        v_tds,null,null,'Pending','Imported from Accounts Excel reconciliation',p_actor
      );
      v_count_tds := v_count_tds + 1;
    end if;
  end loop;

  -- Post bank receipts after all bills/TDS are present. References are unique per insurer.
  for v_group in select * from jsonb_array_elements(coalesce(p_receipt_groups,'[]'::jsonb)) loop
    if exists (
      select 1 from public.accounts_receipts
      where insurer_id=(v_group->>'insurerId')::uuid
        and upper(regexp_replace(coalesce(bank_reference,''),'\s+','','g'))=upper(regexp_replace(v_group->>'reference','\s+','','g'))
    ) then raise exception 'Receipt reference % already exists for this insurer', v_group->>'reference'; end if;

    v_allocations := '[]'::jsonb;
    v_total := 0;
    for v_alloc in select * from jsonb_array_elements(coalesce(v_group->'allocations','[]'::jsonb)) loop
      select id into v_invoice_id
      from public.accounts_invoices
      where insurer_id=(v_group->>'insurerId')::uuid
        and lower(coalesce(invoice_no,''))=lower(btrim(v_alloc->>'billNumber'))
        and status in ('Raised','Partially Received')
      order by created_at desc limit 1;
      if v_invoice_id is null then raise exception 'Bill % is not available for receipt allocation', v_alloc->>'billNumber'; end if;
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('invoiceId',v_invoice_id,'amount',round((v_alloc->>'amount')::numeric,2)));
      v_total := v_total + round((v_alloc->>'amount')::numeric,2);
    end loop;
    perform public.post_accounts_receipt(
      (v_group->>'insurerId')::uuid,(v_group->>'receiptDate')::date,btrim(v_group->>'reference'),
      round(v_total,2),'Imported from Accounts Excel reconciliation',p_actor,v_allocations
    );
    v_count_receipts := v_count_receipts + 1;
  end loop;

  -- Create/approve policy payables on demand, then post each partner payment atomically.
  for v_group in select * from jsonb_array_elements(coalesce(p_payout_groups,'[]'::jsonb)) loop
    if exists (
      select 1 from public.partner_payments
      where upper(regexp_replace(coalesce(intermediary_code,''),'\s+','','g'))=upper(regexp_replace(v_group->>'intermediaryCode','\s+','','g'))
        and upper(regexp_replace(coalesce(payment_reference,''),'\s+','','g'))=upper(regexp_replace(v_group->>'reference','\s+','','g'))
    ) then raise exception 'Partner payment reference % already exists', v_group->>'reference'; end if;

    v_allocations := '[]'::jsonb;
    v_total := 0;
    for v_alloc in select * from jsonb_array_elements(coalesce(v_group->'allocations','[]'::jsonb)) loop
      select id,status into v_payable_id,v_status
      from public.partner_payables
      where policy_payout_id=(v_alloc->>'payoutId')::uuid
      for update;
      if v_payable_id is null then
        v_payable_id := public.create_partner_payable((v_alloc->>'payoutId')::uuid,'Accounts Excel reconciliation import',p_actor);
        v_status := 'Eligible';
      end if;
      if v_status = 'Eligible' then
        perform public.approve_partner_payable(v_payable_id,p_actor);
        v_status := 'Payable Approved';
      end if;
      if v_status not in ('Payable Approved','Payment Initiated') then
        raise exception 'Payout % is not available for payment', v_alloc->>'payoutId';
      end if;
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('payableId',v_payable_id,'amount',round((v_alloc->>'amount')::numeric,2)));
      v_total := v_total + round((v_alloc->>'amount')::numeric,2);
    end loop;
    perform public.post_partner_payment(
      btrim(v_group->>'intermediaryCode'),nullif(btrim(coalesce(v_group->>'intermediaryType','')),''),
      (v_group->>'paidDate')::date,btrim(v_group->>'reference'),round(v_total,2),
      'Imported from Accounts Excel reconciliation',p_actor,v_allocations
    );
    v_count_payments := v_count_payments + 1;
  end loop;

  return jsonb_build_object(
    'invoices',v_count_invoices,
    'tdsEntries',v_count_tds,
    'receipts',v_count_receipts,
    'partnerPayments',v_count_payments
  );
end;
$$;

revoke all on function public.post_accounts_excel_reconciliation(uuid,jsonb,jsonb,jsonb) from public;
grant execute on function public.post_accounts_excel_reconciliation(uuid,jsonb,jsonb,jsonb) to service_role;
