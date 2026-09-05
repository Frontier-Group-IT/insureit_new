import type { ImageSourcePropType } from 'react-native';

import { PartnerAssets } from '@/lib/partner-assets';

export function resolvePartnerScreenArtwork({
  title,
  eyebrow,
}: {
  title: string;
  eyebrow?: string;
}): ImageSourcePropType | undefined {
  const key = `${eyebrow || ''} ${title}`.trim().toLowerCase();

  if (includesAny(key, ['policy intake', 'intake'])) return PartnerAssets.navigation.policyIntake;
  if (includesAny(key, ['renewal'])) return PartnerAssets.navigation.renewals;
  if (includesAny(key, ['claim'])) return PartnerAssets.navigation.claims;
  if (includesAny(key, ['customer'])) return PartnerAssets.navigation.customers;
  if (includesAny(key, ['policies', 'policy book', 'policy portfolio', 'policy detail'])) return PartnerAssets.navigation.policies;
  if (includesAny(key, ['search'])) return PartnerAssets.navigation.search;
  if (includesAny(key, ['support'])) return PartnerAssets.actions.support;
  if (includesAny(key, ['settings', 'app info'])) return PartnerAssets.status.settings;
  if (includesAny(key, ['profile', 'registration'])) return PartnerAssets.navigation.profile;
  if (includesAny(key, ['recognition', 'achievement'])) return PartnerAssets.status.achievement;
  if (includesAny(key, ['journey'])) return PartnerAssets.status.journey;
  if (includesAny(key, ['impact'])) return PartnerAssets.actions.businessInsights;
  if (includesAny(key, ['your week', 'weekly'])) return PartnerAssets.actions.businessPerformance;
  if (includesAny(key, ['learn', 'academy'])) return PartnerAssets.actions.policyChecklist;
  if (includesAny(key, ['stories', 'story'])) return PartnerAssets.status.businessGrowth;
  if (includesAny(key, ['activity', 'announcement'])) return PartnerAssets.status.announcement;
  if (includesAny(key, ['payout', 'earning'])) return PartnerAssets.actions.payoutGrowth;
  if (includesAny(key, ['business', 'performance', 'network'])) return PartnerAssets.navigation.business;
  if (includesAny(key, ['more', 'explore'])) return PartnerAssets.status.appsGrid;
  if (includesAny(key, ['insureit partner', 'good morning', 'good afternoon', 'good evening'])) return PartnerAssets.navigation.home;

  return undefined;
}

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}
