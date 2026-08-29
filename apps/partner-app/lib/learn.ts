import { supabase } from '@/lib/supabase';

export type LearningOption = {
  key: string;
  label: string;
};

export type PartnerLearningToday = {
  available: boolean;
  generated_at: string;
  card?: {
    id: string;
    code: string;
    category: string;
    prompt: string;
    options: LearningOption[];
  };
  answered_today?: boolean;
  answer?: {
    selected_option_key: string;
    is_correct: boolean;
    correct_option_key: string;
    explanation: string;
  } | null;
  stats: {
    attempted_days: number;
    total_attempts: number;
    correct_answers: number;
    current_streak: number;
  };
};

export type LearningSubmission = {
  selected_option_key: string;
  is_correct: boolean;
  correct_option_key: string;
  explanation: string;
  today: PartnerLearningToday;
};

export async function getPartnerLearningToday() {
  const { data, error } = await supabase.rpc('partner_app_learning_today');
  if (error) throw error;
  if (!data) throw new Error('Learning is unavailable.');
  return data as PartnerLearningToday;
}

export async function submitPartnerLearningAnswer(cardId: string, selectedOptionKey: string) {
  const { data, error } = await supabase.rpc('partner_app_submit_learning_answer', {
    p_card_id: cardId,
    p_selected_option_key: selectedOptionKey,
  });
  if (error) throw error;
  if (!data) throw new Error('Your answer could not be submitted.');
  return data as LearningSubmission;
}
