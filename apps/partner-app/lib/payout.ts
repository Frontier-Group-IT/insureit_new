import { supabase } from '@/lib/supabase';

export type PartnerPayoutRecent = {
  id: string;
  policy_id: string;
  policy_no: string;
  customer_name: string;
  amount: number | string;
  status: string;
  commercial_status: string;
  payout_date: string | null;
  voucher_number: string | null;
  updated_at: string;
};

export type PartnerPayoutSummary =
  | {
      available: false;
      visibility: 'restricted';
      generated_at: string;
      reason: string;
    }
  | {
      available: true;
      visibility: 'self';
      generated_at: string;
      intermediary_code: string;
      recorded_amount: number | string;
      pending_amount: number | string;
      eligible_amount: number | string;
      needs_review_amount: number | string;
      paid_amount: number | string;
      total_rows: number;
      pending_count: number;
      paid_count: number;
      needs_review_count: number;
      recent: PartnerPayoutRecent[];
    };

export async function getPartnerPayoutSummary() {
  const { data, error } = await supabase.rpc('partner_app_payout_summary');
  if (error) throw error;
  if (!data) throw new Error('Partner payout information is unavailable.');
  return data as PartnerPayoutSummary;
}
