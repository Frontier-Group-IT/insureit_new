import { supabase } from '@/lib/supabase';

export type PartnerStory = {
  kind: 'today' | 'impact' | 'journey' | 'business' | 'learn';
  eyebrow: string;
  title: string;
  body: string;
  route: string;
  tone: 'attention' | 'calm' | 'impact' | 'journey' | 'business' | 'learn';
  metric?: number | string;
  metric_label?: string;
  progress_current?: number;
  progress_target?: number;
  answered_today?: boolean;
};

export type PartnerStoriesData = {
  generated_at: string;
  items: PartnerStory[];
};

export async function getPartnerStories() {
  const { data, error } = await supabase.rpc('partner_app_stories');
  if (error) throw error;
  if (!data) throw new Error('Stories are unavailable.');
  return data as PartnerStoriesData;
}
