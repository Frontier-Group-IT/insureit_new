-- Accounts reconciliation: Bill/Invoice No. is business data, not a unique transaction key.
-- Duplicate bill numbers are legitimate across policy allocations/imports.

DROP INDEX IF EXISTS public.accounts_invoices_invoice_no_uidx;
CREATE INDEX IF NOT EXISTS accounts_invoices_invoice_no_idx
  ON public.accounts_invoices (upper(btrim(invoice_no)))
  WHERE invoice_no IS NOT NULL AND btrim(invoice_no) <> '';

CREATE OR REPLACE FUNCTION public.post_accounts_excel_reconciliation(
  p_actor uuid,
  p_invoice_groups jsonb,
  p_receipt_groups jsonb,
  p_payout_groups jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group jsonb;
  v_line jsonb;
  v_alloc jsonb;
  v_invoice_id uuid;
  v_payable_id uuid;
  v_total numeric(14,2);
  v_tds numeric(14,2);
  v_allocations jsonb;
  v_count_invoices integer := 0;
  v_count_receipts integer := 0;
  v_count_tds integer := 0;
  v_count_payments integer := 0;
  v_status text;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'Actor is required'; END IF;
  IF jsonb_typeof(coalesce(p_invoice_groups,'[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_receipt_groups,'[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_payout_groups,'[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid import payload';
  END IF;

  -- Bill number is intentionally not used as a duplicate-rejection key.
  FOR v_group IN SELECT * FROM jsonb_array_elements(coalesce(p_invoice_groups,'[]'::jsonb)) LOOP
    IF nullif(btrim(v_group->>'billNumber'),'') IS NULL
       OR nullif(v_group->>'billDate','') IS NULL
       OR nullif(v_group->>'insurerId','') IS NULL THEN
      RAISE EXCEPTION 'Insurer, bill number and bill date are required';
    END IF;

    SELECT round(coalesce(sum((x->>'billAmount')::numeric),0),2)
      INTO v_total
    FROM jsonb_array_elements(coalesce(v_group->'lines','[]'::jsonb)) x;
    IF v_total <= 0 THEN RAISE EXCEPTION 'Bill total must be positive'; END IF;

    INSERT INTO public.accounts_invoices(
      insurer_id, invoice_no, invoice_date, status,
      brokerage_subtotal, tax_amount, gross_invoice_amount, outstanding_amount,
      tax_treatment, notes, created_by, raised_by, raised_at
    ) VALUES (
      (v_group->>'insurerId')::uuid,
      btrim(v_group->>'billNumber'),
      (v_group->>'billDate')::date,
      'Raised', v_total, 0, v_total, v_total,
      'Excel reconciliation', 'Created from Accounts Excel reconciliation import',
      p_actor, p_actor, now()
    ) RETURNING id INTO v_invoice_id;

    FOR v_line IN SELECT * FROM jsonb_array_elements(coalesce(v_group->'lines','[]'::jsonb)) LOOP
      IF coalesce((v_line->>'billAmount')::numeric,0) <= 0 THEN RAISE EXCEPTION 'Bill line amount must be positive'; END IF;
      INSERT INTO public.accounts_invoice_lines(
        invoice_id, policy_id, policy_no, line_type,
        recognized_brokerage_amount, adjustment_amount, invoice_line_amount, description
      ) VALUES (
        v_invoice_id,
        (v_line->>'policyId')::uuid,
        nullif(v_line->>'policyNumber',''),
        'Brokerage',
        round(coalesce((v_line->>'projectedPayin')::numeric,0),2),
        round(coalesce((v_line->>'billAmount')::numeric,0)-coalesce((v_line->>'projectedPayin')::numeric,0),2),
        round((v_line->>'billAmount')::numeric,2),
        'Accounts Excel reconciliation line'
      );
    END LOOP;

    INSERT INTO public.accounts_receivable_entries(
      insurer_id, invoice_id, entry_date, entry_type, document_reference,
      debit_amount, credit_amount, description, created_by
    ) VALUES (
      (v_group->>'insurerId')::uuid, v_invoice_id, (v_group->>'billDate')::date,
      'Invoice', btrim(v_group->>'billNumber'), v_total, 0,
      'Brokerage bill raised from Accounts Excel reconciliation', p_actor
    );
    INSERT INTO public.accounts_invoice_events(
      invoice_id,event_type,to_status,event_data,actor_profile_id
    ) VALUES (
      v_invoice_id,'Invoice imported and raised','Raised',
      jsonb_build_object('source','accounts_excel_reconciliation','gross_invoice_amount',v_total),p_actor
    );
    v_count_invoices := v_count_invoices + 1;

    v_tds := round(coalesce((v_group->>'actualTds')::numeric,0),2);
    IF v_tds > 0 THEN
      PERFORM public.post_accounts_tds(
        v_invoice_id,
        coalesce(nullif(v_group->>'tdsDate','')::date,(v_group->>'billDate')::date),
        v_tds,null,null,'Pending','Imported from Accounts Excel reconciliation',p_actor
      );
      v_count_tds := v_count_tds + 1;
    END IF;
  END LOOP;

  -- Receipt references remain unique per insurer. Existing allocation behavior is preserved.
  FOR v_group IN SELECT * FROM jsonb_array_elements(coalesce(p_receipt_groups,'[]'::jsonb)) LOOP
    IF EXISTS (
      SELECT 1 FROM public.accounts_receipts
      WHERE insurer_id=(v_group->>'insurerId')::uuid
        AND upper(regexp_replace(coalesce(bank_reference,''),'\s+','','g'))=upper(regexp_replace(v_group->>'reference','\s+','','g'))
    ) THEN RAISE EXCEPTION 'Receipt reference % already exists for this insurer', v_group->>'reference'; END IF;

    v_allocations := '[]'::jsonb;
    v_total := 0;
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(coalesce(v_group->'allocations','[]'::jsonb)) LOOP
      SELECT id INTO v_invoice_id
      FROM public.accounts_invoices
      WHERE insurer_id=(v_group->>'insurerId')::uuid
        AND lower(coalesce(invoice_no,''))=lower(btrim(v_alloc->>'billNumber'))
        AND status IN ('Raised','Partially Received')
      ORDER BY created_at DESC LIMIT 1;
      IF v_invoice_id IS NULL THEN RAISE EXCEPTION 'Bill % is not available for receipt allocation', v_alloc->>'billNumber'; END IF;
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('invoiceId',v_invoice_id,'amount',round((v_alloc->>'amount')::numeric,2)));
      v_total := v_total + round((v_alloc->>'amount')::numeric,2);
    END LOOP;
    PERFORM public.post_accounts_receipt(
      (v_group->>'insurerId')::uuid,(v_group->>'receiptDate')::date,btrim(v_group->>'reference'),
      round(v_total,2),'Imported from Accounts Excel reconciliation',p_actor,v_allocations
    );
    v_count_receipts := v_count_receipts + 1;
  END LOOP;

  FOR v_group IN SELECT * FROM jsonb_array_elements(coalesce(p_payout_groups,'[]'::jsonb)) LOOP
    IF EXISTS (
      SELECT 1 FROM public.partner_payments
      WHERE upper(regexp_replace(coalesce(intermediary_code,''),'\s+','','g'))=upper(regexp_replace(v_group->>'intermediaryCode','\s+','','g'))
        AND upper(regexp_replace(coalesce(payment_reference,''),'\s+','','g'))=upper(regexp_replace(v_group->>'reference','\s+','','g'))
    ) THEN RAISE EXCEPTION 'Partner payment reference % already exists', v_group->>'reference'; END IF;

    v_allocations := '[]'::jsonb;
    v_total := 0;
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(coalesce(v_group->'allocations','[]'::jsonb)) LOOP
      SELECT id,status INTO v_payable_id,v_status
      FROM public.partner_payables
      WHERE policy_payout_id=(v_alloc->>'payoutId')::uuid
      FOR UPDATE;
      IF v_payable_id IS NULL THEN
        v_payable_id := public.create_partner_payable((v_alloc->>'payoutId')::uuid,'Accounts Excel reconciliation import',p_actor);
        v_status := 'Eligible';
      END IF;
      IF v_status = 'Eligible' THEN
        PERFORM public.approve_partner_payable(v_payable_id,p_actor);
        v_status := 'Payable Approved';
      END IF;
      IF v_status NOT IN ('Payable Approved','Payment Initiated') THEN
        RAISE EXCEPTION 'Payout % is not available for payment', v_alloc->>'payoutId';
      END IF;
      v_allocations := v_allocations || jsonb_build_array(jsonb_build_object('payableId',v_payable_id,'amount',round((v_alloc->>'amount')::numeric,2)));
      v_total := v_total + round((v_alloc->>'amount')::numeric,2);
    END LOOP;
    PERFORM public.post_partner_payment(
      btrim(v_group->>'intermediaryCode'),nullif(btrim(coalesce(v_group->>'intermediaryType','')),''),
      (v_group->>'paidDate')::date,btrim(v_group->>'reference'),round(v_total,2),
      'Imported from Accounts Excel reconciliation',p_actor,v_allocations
    );
    v_count_payments := v_count_payments + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'invoices',v_count_invoices,
    'tdsEntries',v_count_tds,
    'receipts',v_count_receipts,
    'partnerPayments',v_count_payments
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_accounts_excel_reconciliation(uuid,jsonb,jsonb,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.post_accounts_excel_reconciliation(uuid,jsonb,jsonb,jsonb) TO service_role;
