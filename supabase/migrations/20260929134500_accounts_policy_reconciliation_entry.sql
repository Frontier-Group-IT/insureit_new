-- Accounts V2: atomic policy-wise portal posting for append-only Pay-In/Payout entries.
-- Keeps the visible Business MIS contract unchanged while preserving transaction history.

CREATE OR REPLACE FUNCTION public.post_accounts_policy_reconciliation_entry(
  p_actor uuid,
  p_policy_id uuid,
  p_entry_type text,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_policy public.policies%rowtype;
  v_payout public.policy_intermediary_payouts%rowtype;
  v_payable public.partner_payables%rowtype;
  v_invoice_id uuid;
  v_payment_id uuid;
  v_payable_id uuid;
  v_bill_number text;
  v_bill_date date;
  v_bill_amount numeric(14,2);
  v_actual_tds numeric(14,2);
  v_projected_payin numeric(14,2);
  v_paid_date date;
  v_reference text;
  v_paid_amount numeric(14,2);
  v_remarks text;
  v_payout_count integer;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'Actor is required'; END IF;
  IF p_policy_id IS NULL THEN RAISE EXCEPTION 'Policy is required'; END IF;
  IF jsonb_typeof(coalesce(p_payload, '{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'Invalid reconciliation payload'; END IF;

  -- Serialize direct portal writes per policy so duplicate checks and append operations cannot race.
  SELECT * INTO v_policy
  FROM public.policies
  WHERE id = p_policy_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Policy not found'; END IF;

  v_remarks := nullif(btrim(coalesce(p_payload->>'remarks','')), '');

  IF lower(coalesce(p_entry_type,'')) = 'payin' THEN
    IF v_policy.insurance_company_id IS NULL THEN RAISE EXCEPTION 'Policy insurer is required for Pay-In reconciliation'; END IF;

    v_bill_number := nullif(btrim(coalesce(p_payload->>'billNumber','')), '');
    v_bill_date := nullif(p_payload->>'billDate','')::date;
    v_bill_amount := round(coalesce((p_payload->>'billAmount')::numeric,0),2);
    v_actual_tds := round(coalesce(nullif(p_payload->>'actualTds','')::numeric,0),2);

    IF v_bill_number IS NULL OR v_bill_date IS NULL OR v_bill_amount <= 0 THEN
      RAISE EXCEPTION 'Bill number, bill date and positive Bill Amount are required';
    END IF;
    IF v_actual_tds < 0 OR v_actual_tds > v_bill_amount THEN
      RAISE EXCEPTION 'TDS must be between zero and the Bill Amount';
    END IF;

    -- Bill numbers can legitimately repeat across policies. Block only the same policy/date/amount
    -- transaction from being appended twice. The policy row lock makes this check atomic for portal writes.
    IF EXISTS (
      SELECT 1
      FROM public.accounts_invoice_lines l
      JOIN public.accounts_invoices i ON i.id = l.invoice_id
      WHERE l.policy_id = p_policy_id
        AND i.status <> 'Cancelled'
        AND upper(regexp_replace(coalesce(i.invoice_no,''),'\s+','','g')) = upper(regexp_replace(v_bill_number,'\s+','','g'))
        AND i.invoice_date = v_bill_date
        AND round(coalesce(l.invoice_line_amount,0),2) = v_bill_amount
    ) THEN
      RAISE EXCEPTION 'This Pay-In entry is already recorded for the policy';
    END IF;

    SELECT round(coalesce(total_projected_payin,0),2)
      INTO v_projected_payin
    FROM public.policy_payin_details
    WHERE policy_id = p_policy_id
    LIMIT 1;
    v_projected_payin := coalesce(v_projected_payin,0);

    INSERT INTO public.accounts_invoices(
      insurer_id, invoice_no, invoice_date, status,
      brokerage_subtotal, tax_amount, gross_invoice_amount, outstanding_amount,
      tax_treatment, notes, created_by, raised_by, raised_at
    ) VALUES (
      v_policy.insurance_company_id,
      v_bill_number,
      v_bill_date,
      'Raised',
      v_bill_amount, 0, v_bill_amount, v_bill_amount,
      'Accounts portal reconciliation',
      coalesce(v_remarks, 'Created from Accounts policy reconciliation'),
      p_actor, p_actor, now()
    ) RETURNING id INTO v_invoice_id;

    INSERT INTO public.accounts_invoice_lines(
      invoice_id, policy_id, policy_no, line_type,
      recognized_brokerage_amount, adjustment_amount, invoice_line_amount, description
    ) VALUES (
      v_invoice_id,
      p_policy_id,
      nullif(v_policy.policy_no,''),
      'Brokerage',
      v_projected_payin,
      round(v_bill_amount - v_projected_payin,2),
      v_bill_amount,
      'Accounts policy reconciliation entry'
    );

    INSERT INTO public.accounts_receivable_entries(
      insurer_id, invoice_id, entry_date, entry_type, document_reference,
      debit_amount, credit_amount, description, created_by
    ) VALUES (
      v_policy.insurance_company_id, v_invoice_id, v_bill_date,
      'Invoice', v_bill_number, v_bill_amount, 0,
      'Brokerage bill raised from Accounts policy reconciliation', p_actor
    );

    INSERT INTO public.accounts_invoice_events(
      invoice_id,event_type,to_status,event_data,actor_profile_id
    ) VALUES (
      v_invoice_id,'Policy Pay-In posted','Raised',
      jsonb_build_object('source','accounts_policy_reconciliation','gross_invoice_amount',v_bill_amount),p_actor
    );

    IF v_actual_tds > 0 THEN
      PERFORM public.post_accounts_tds(
        v_invoice_id,
        v_bill_date,
        v_actual_tds,
        null,
        null,
        'Pending',
        coalesce(v_remarks, 'Posted from Accounts policy reconciliation'),
        p_actor
      );
    END IF;

    RETURN jsonb_build_object(
      'entryType','payin',
      'invoiceId',v_invoice_id,
      'amount',v_bill_amount,
      'tds',v_actual_tds
    );
  END IF;

  IF lower(coalesce(p_entry_type,'')) = 'payout' THEN
    v_paid_date := nullif(p_payload->>'paidDate','')::date;
    v_reference := nullif(btrim(coalesce(p_payload->>'reference','')), '');
    v_paid_amount := round(coalesce((p_payload->>'paidAmount')::numeric,0),2);

    IF v_paid_date IS NULL OR v_reference IS NULL OR v_paid_amount <= 0 THEN
      RAISE EXCEPTION 'Paid date, UTR/reference and positive Paid Amount are required';
    END IF;

    SELECT count(*) INTO v_payout_count
    FROM public.policy_intermediary_payouts
    WHERE policy_id = p_policy_id;
    IF v_payout_count = 0 THEN RAISE EXCEPTION 'No partner payout is configured for this policy'; END IF;
    IF v_payout_count > 1 THEN RAISE EXCEPTION 'This policy has multiple payout records. Use the bulk reconciliation workflow until a specific payout can be selected'; END IF;

    SELECT * INTO v_payout
    FROM public.policy_intermediary_payouts
    WHERE policy_id = p_policy_id
    FOR UPDATE;

    IF nullif(btrim(coalesce(v_payout.intermediary_code,'')), '') IS NULL THEN
      RAISE EXCEPTION 'Intermediary code is required before posting payout';
    END IF;
    IF v_payout.commercial_status NOT IN ('entered','reviewed') THEN
      RAISE EXCEPTION 'Partner commercial must be entered/reviewed before payment';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.partner_payments
      WHERE upper(regexp_replace(coalesce(intermediary_code,''),'\s+','','g')) = upper(regexp_replace(v_payout.intermediary_code,'\s+','','g'))
        AND upper(regexp_replace(coalesce(payment_reference,''),'\s+','','g')) = upper(regexp_replace(v_reference,'\s+','','g'))
    ) THEN
      RAISE EXCEPTION 'This UTR/reference is already recorded for the intermediary';
    END IF;

    SELECT * INTO v_payable
    FROM public.partner_payables
    WHERE policy_payout_id = v_payout.id
    FOR UPDATE;

    IF NOT FOUND THEN
      v_payable_id := public.create_partner_payable(v_payout.id,'Accounts policy reconciliation',p_actor);
      SELECT * INTO v_payable FROM public.partner_payables WHERE id = v_payable_id FOR UPDATE;
    END IF;

    IF v_payable.status = 'Eligible' THEN
      PERFORM public.approve_partner_payable(v_payable.id,p_actor);
      SELECT * INTO v_payable FROM public.partner_payables WHERE id = v_payable.id FOR UPDATE;
    END IF;

    IF v_payable.status NOT IN ('Payable Approved','Payment Initiated') THEN
      RAISE EXCEPTION 'Payout is not available for payment';
    END IF;
    IF v_paid_amount > coalesce(v_payable.outstanding_amount,0) THEN
      RAISE EXCEPTION 'Paid Amount exceeds the remaining payable balance';
    END IF;

    v_payment_id := public.post_partner_payment(
      v_payout.intermediary_code,
      nullif(btrim(coalesce(v_payout.intermediary_type,'')),''),
      v_paid_date,
      v_reference,
      v_paid_amount,
      coalesce(v_remarks, 'Posted from Accounts policy reconciliation'),
      p_actor,
      jsonb_build_array(jsonb_build_object('payableId',v_payable.id,'amount',v_paid_amount))
    );

    RETURN jsonb_build_object(
      'entryType','payout',
      'paymentId',v_payment_id,
      'amount',v_paid_amount,
      'payoutId',v_payout.id
    );
  END IF;

  RAISE EXCEPTION 'Entry type must be payin or payout';
END;
$$;

REVOKE ALL ON FUNCTION public.post_accounts_policy_reconciliation_entry(uuid,uuid,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.post_accounts_policy_reconciliation_entry(uuid,uuid,text,jsonb) TO service_role;
