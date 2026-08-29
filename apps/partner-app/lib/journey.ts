import { supabase } from '@/lib/supabase';

export type PartnerJourneyData = {
  generated_at: string;
  policy_count: number;
  customer_count: number;
  claim_count: number;
  milestones: {
    date: string;
    kind: string;
    title: string;
    subtitle: string;
  }[];
  next_milestone: {
    kind: 'customers';
    current: number;
    target: number;
    remaining: number;
    title: string;
  };
};

export async function getPartnerJourney() {
  const { data, error } = await supabase.rpc('partner_app_journey');
  if (error) throw error;
  if (!data) throw new Error('Journey data is unavailable.');
  return data as PartnerJourneyData;
}
