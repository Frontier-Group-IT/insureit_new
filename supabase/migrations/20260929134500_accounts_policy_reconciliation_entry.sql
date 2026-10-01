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

REVOKE ALL ON FUNCTION public.post_accounts_policy_reconciliation_entry(uuid,uuid,text,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.post_accounts_policy_reconciliation_entry(uuid,uuid,text,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.post_accounts_policy_reconciliation_entry(uuid,uuid,text,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.post_accounts_policy_reconciliation_entry(uuid,uuid,text,jsonb) TO service_role;

-- Accounts V2 correction extension: eligible Accounts users may audited-edit or reverse
-- direct reconciliation entries without physically deleting the financial record.
CREATE TABLE IF NOT EXISTS public.accounts_reconciliation_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.policies(id),
  entry_type text NOT NULL CHECK (entry_type IN ('payin','payout')),
  target_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('edit','reverse')),
  reason text NOT NULL,
  before_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_payload jsonb,
  actor_profile_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS accounts_reconciliation_corrections_target_idx
  ON public.accounts_reconciliation_corrections(entry_type,target_id,created_at DESC);
CREATE INDEX IF NOT EXISTS accounts_reconciliation_corrections_policy_idx
  ON public.accounts_reconciliation_corrections(policy_id,created_at DESC);
ALTER TABLE public.accounts_reconciliation_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.accounts_reconciliation_corrections FROM anon,authenticated;
GRANT ALL ON TABLE public.accounts_reconciliation_corrections TO service_role;

-- Reversal keeps partner payment/allocation rows in place for audit. Zero values mean the
-- payment no longer contributes to active reconciliation totals.
ALTER TABLE public.partner_payments DROP CONSTRAINT IF EXISTS partner_payments_payment_amount_check;
ALTER TABLE public.partner_payments ADD CONSTRAINT partner_payments_payment_amount_check CHECK (payment_amount >= 0);
ALTER TABLE public.partner_payment_allocations DROP CONSTRAINT IF EXISTS partner_payment_allocations_allocated_amount_check;
ALTER TABLE public.partner_payment_allocations ADD CONSTRAINT partner_payment_allocations_allocated_amount_check CHECK (allocated_amount >= 0);

CREATE OR REPLACE FUNCTION public.correct_accounts_policy_reconciliation_entry(
  p_actor uuid,
  p_policy_id uuid,
  p_entry_type text,
  p_target_id uuid,
  p_action text,
  p_reason text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text := lower(coalesce(p_action,''));
  v_kind text := lower(coalesce(p_entry_type,''));
  v_reason text := nullif(btrim(coalesce(p_reason,'')), '');
  v_invoice public.accounts_invoices%rowtype;
  v_line public.accounts_invoice_lines%rowtype;
  v_payment public.partner_payments%rowtype;
  v_alloc public.partner_payment_allocations%rowtype;
  v_payable public.partner_payables%rowtype;
  v_old_amount numeric(14,2);
  v_new_amount numeric(14,2);
  v_new_outstanding numeric(14,2);
  v_bill_number text;
  v_bill_date date;
  v_paid_date date;
  v_reference text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF p_actor IS NULL OR p_policy_id IS NULL OR p_target_id IS NULL THEN RAISE EXCEPTION 'Actor, policy and reconciliation entry are required'; END IF;
  IF v_action NOT IN ('edit','reverse') THEN RAISE EXCEPTION 'Correction action must be edit or reverse'; END IF;
  IF v_kind NOT IN ('payin','payout') THEN RAISE EXCEPTION 'Entry type must be payin or payout'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Correction reason is required'; END IF;

  PERFORM 1 FROM public.policies WHERE id=p_policy_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Policy not found'; END IF;

  IF v_kind='payin' THEN
    SELECT * INTO v_invoice FROM public.accounts_invoices WHERE id=p_target_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pay-In entry not found'; END IF;
    SELECT * INTO v_line FROM public.accounts_invoice_lines WHERE invoice_id=p_target_id AND policy_id=p_policy_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pay-In entry does not belong to this policy'; END IF;
    IF v_invoice.status='Cancelled' THEN RAISE EXCEPTION 'This Pay-In entry is already reversed'; END IF;

    v_old_amount:=round(coalesce(v_line.invoice_line_amount,0),2);
    v_before:=jsonb_build_object('billNumber',v_invoice.invoice_no,'billDate',v_invoice.invoice_date,'billAmount',v_old_amount,'status',v_invoice.status,'outstanding',v_invoice.outstanding_amount);

    IF v_action='reverse' THEN
      IF coalesce(v_invoice.outstanding_amount,0)>0 THEN
        INSERT INTO public.accounts_receivable_entries(
          insurer_id,invoice_id,entry_date,entry_type,document_reference,debit_amount,credit_amount,description,created_by
        ) VALUES (
          v_invoice.insurer_id,v_invoice.id,current_date,'Reversal',v_invoice.invoice_no,0,v_invoice.outstanding_amount,
          'Accounts reconciliation reversal: '||v_reason,p_actor
        );
      END IF;
      UPDATE public.accounts_invoices SET status='Cancelled',outstanding_amount=0,notes=concat_ws(' | ',nullif(notes,''),'REVERSED: '||v_reason) WHERE id=v_invoice.id;
      INSERT INTO public.accounts_invoice_events(invoice_id,event_type,from_status,to_status,reason,event_data,actor_profile_id)
      VALUES(v_invoice.id,'Policy Pay-In reversed',v_invoice.status,'Cancelled',v_reason,jsonb_build_object('source','accounts_policy_reconciliation_correction','amount',v_old_amount),p_actor);
      v_after:=jsonb_build_object('status','Cancelled','billAmount',v_old_amount);
    ELSE
      v_bill_number:=nullif(btrim(coalesce(p_payload->>'billNumber','')), '');
      v_bill_date:=nullif(p_payload->>'billDate','')::date;
      v_new_amount:=round(coalesce((p_payload->>'billAmount')::numeric,0),2);
      IF v_bill_number IS NULL OR v_bill_date IS NULL OR v_new_amount<=0 THEN RAISE EXCEPTION 'Bill number, bill date and positive Bill Amount are required'; END IF;
      IF EXISTS (
        SELECT 1 FROM public.accounts_invoice_lines l JOIN public.accounts_invoices i ON i.id=l.invoice_id
        WHERE l.policy_id=p_policy_id AND i.id<>v_invoice.id AND i.status<>'Cancelled'
          AND upper(regexp_replace(coalesce(i.invoice_no,''),'\s+','','g'))=upper(regexp_replace(v_bill_number,'\s+','','g'))
          AND i.invoice_date=v_bill_date AND round(coalesce(l.invoice_line_amount,0),2)=v_new_amount
      ) THEN RAISE EXCEPTION 'This Pay-In entry is already recorded for the policy'; END IF;

      v_new_outstanding:=greatest(0,round(coalesce(v_invoice.outstanding_amount,0)+(v_new_amount-v_old_amount),2));
      UPDATE public.accounts_invoices SET
        invoice_no=v_bill_number,invoice_date=v_bill_date,brokerage_subtotal=v_new_amount,gross_invoice_amount=v_new_amount,
        outstanding_amount=v_new_outstanding,
        status=CASE WHEN v_new_outstanding<=0.01 THEN 'Received' WHEN v_new_outstanding<v_new_amount-0.01 THEN 'Partially Received' ELSE 'Raised' END,
        notes=concat_ws(' | ',nullif(notes,''),'EDITED: '||v_reason)
      WHERE id=v_invoice.id;
      UPDATE public.accounts_invoice_lines SET
        invoice_line_amount=v_new_amount,
        adjustment_amount=round(v_new_amount-coalesce(recognized_brokerage_amount,0),2)
      WHERE id=v_line.id;
      UPDATE public.accounts_receivable_entries SET entry_date=v_bill_date,document_reference=v_bill_number,debit_amount=v_new_amount
      WHERE invoice_id=v_invoice.id AND entry_type='Invoice';
      INSERT INTO public.accounts_invoice_events(invoice_id,event_type,from_status,to_status,reason,event_data,actor_profile_id)
      VALUES(v_invoice.id,'Policy Pay-In edited',v_invoice.status,
        CASE WHEN v_new_outstanding<=0.01 THEN 'Received' WHEN v_new_outstanding<v_new_amount-0.01 THEN 'Partially Received' ELSE 'Raised' END,
        v_reason,jsonb_build_object('source','accounts_policy_reconciliation_correction','before',v_before,'newAmount',v_new_amount),p_actor);
      v_after:=jsonb_build_object('billNumber',v_bill_number,'billDate',v_bill_date,'billAmount',v_new_amount,'outstanding',v_new_outstanding);
    END IF;

    INSERT INTO public.accounts_reconciliation_corrections(policy_id,entry_type,target_id,action,reason,before_payload,after_payload,actor_profile_id)
    VALUES(p_policy_id,'payin',v_invoice.id,v_action,v_reason,v_before,v_after,p_actor);
    RETURN jsonb_build_object('entryType','payin','targetId',v_invoice.id,'action',v_action);
  END IF;

  SELECT * INTO v_payment FROM public.partner_payments WHERE id=p_target_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout entry not found'; END IF;
  SELECT a.* INTO v_alloc
  FROM public.partner_payment_allocations a
  JOIN public.partner_payables pp ON pp.id=a.payable_id
  WHERE a.payment_id=v_payment.id AND pp.policy_id=p_policy_id
  FOR UPDATE OF a;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout entry does not belong to this policy'; END IF;
  SELECT * INTO v_payable FROM public.partner_payables WHERE id=v_alloc.payable_id FOR UPDATE;
  IF v_payable.status='Closed' THEN RAISE EXCEPTION 'Closed payout entries cannot be corrected'; END IF;
  IF coalesce(v_alloc.allocated_amount,0)<=0 THEN RAISE EXCEPTION 'This Payout entry is already reversed'; END IF;

  v_old_amount:=round(v_alloc.allocated_amount,2);
  v_before:=jsonb_build_object('paidAmount',v_old_amount,'paidDate',v_payment.payment_date,'reference',v_payment.payment_reference,'payableStatus',v_payable.status,'outstanding',v_payable.outstanding_amount);

  IF v_action='reverse' THEN
    v_new_outstanding:=least(v_payable.agreed_amount,round(v_payable.outstanding_amount+v_old_amount,2));
    UPDATE public.partner_payment_allocations SET allocated_amount=0 WHERE id=v_alloc.id;
    UPDATE public.partner_payments SET payment_amount=0,notes=concat_ws(' | ',nullif(notes,''),'REVERSED: '||v_reason) WHERE id=v_payment.id;
    UPDATE public.partner_payables SET
      outstanding_amount=v_new_outstanding,
      status=CASE WHEN v_new_outstanding>=agreed_amount-0.01 THEN 'Payable Approved' ELSE 'Payment Initiated' END,
      updated_at=now()
    WHERE id=v_payable.id;
    INSERT INTO public.partner_payable_events(payable_id,event_type,from_status,to_status,reason,event_data,actor_profile_id)
    VALUES(v_payable.id,'Payment reversed',v_payable.status,
      CASE WHEN v_new_outstanding>=v_payable.agreed_amount-0.01 THEN 'Payable Approved' ELSE 'Payment Initiated' END,
      v_reason,jsonb_build_object('payment_id',v_payment.id,'amount',v_old_amount),p_actor);
    v_after:=jsonb_build_object('paidAmount',0,'status','Reversed','outstanding',v_new_outstanding);
  ELSE
    v_paid_date:=nullif(p_payload->>'paidDate','')::date;
    v_reference:=nullif(btrim(coalesce(p_payload->>'reference','')), '');
    v_new_amount:=round(coalesce((p_payload->>'paidAmount')::numeric,0),2);
    IF v_paid_date IS NULL OR v_reference IS NULL OR v_new_amount<=0 THEN RAISE EXCEPTION 'Paid date, UTR/reference and positive Paid Amount are required'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.partner_payments p
      WHERE p.id<>v_payment.id
        AND upper(regexp_replace(coalesce(p.intermediary_code,''),'\s+','','g'))=upper(regexp_replace(v_payment.intermediary_code,'\s+','','g'))
        AND upper(regexp_replace(coalesce(p.payment_reference,''),'\s+','','g'))=upper(regexp_replace(v_reference,'\s+','','g'))
    ) THEN RAISE EXCEPTION 'This UTR/reference is already recorded for the intermediary'; END IF;

    v_new_outstanding:=round(v_payable.outstanding_amount+v_old_amount-v_new_amount,2);
    IF v_new_outstanding<0 OR v_new_outstanding>v_payable.agreed_amount THEN RAISE EXCEPTION 'Paid Amount exceeds the remaining payable balance'; END IF;
    UPDATE public.partner_payments SET payment_date=v_paid_date,payment_reference=v_reference,payment_amount=v_new_amount,notes=concat_ws(' | ',nullif(notes,''),'EDITED: '||v_reason) WHERE id=v_payment.id;
    UPDATE public.partner_payment_allocations SET allocated_amount=v_new_amount WHERE id=v_alloc.id;
    UPDATE public.partner_payables SET outstanding_amount=v_new_outstanding,
      status=CASE WHEN v_new_outstanding<=0.01 THEN 'Paid' ELSE 'Payment Initiated' END,updated_at=now()
    WHERE id=v_payable.id;
    INSERT INTO public.partner_payable_events(payable_id,event_type,from_status,to_status,reason,event_data,actor_profile_id)
    VALUES(v_payable.id,'Payment edited',v_payable.status,CASE WHEN v_new_outstanding<=0.01 THEN 'Paid' ELSE 'Payment Initiated' END,
      v_reason,jsonb_build_object('payment_id',v_payment.id,'before',v_before,'newAmount',v_new_amount,'payment_reference',v_reference),p_actor);
    v_after:=jsonb_build_object('paidAmount',v_new_amount,'paidDate',v_paid_date,'reference',v_reference,'outstanding',v_new_outstanding);
  END IF;

  INSERT INTO public.accounts_reconciliation_corrections(policy_id,entry_type,target_id,action,reason,before_payload,after_payload,actor_profile_id)
  VALUES(p_policy_id,'payout',v_payment.id,v_action,v_reason,v_before,v_after,p_actor);
  RETURN jsonb_build_object('entryType','payout','targetId',v_payment.id,'action',v_action);
END;
$$;

REVOKE ALL ON FUNCTION public.correct_accounts_policy_reconciliation_entry(uuid,uuid,text,uuid,text,text,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.correct_accounts_policy_reconciliation_entry(uuid,uuid,text,uuid,text,text,jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.correct_accounts_policy_reconciliation_entry(uuid,uuid,text,uuid,text,text,jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.correct_accounts_policy_reconciliation_entry(uuid,uuid,text,uuid,text,text,jsonb) TO service_role;
