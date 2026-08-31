import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import type { PartnerStory } from '@/lib/stories';
import { partnerTheme } from '@/lib/theme';

export function StoryRail({ stories }: { stories: PartnerStory[] }) {
  const router = useRouter();
  if (!stories.length) return null;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>INSUREIT Stories</Text>
      </View>

      <View style={styles.rail}>
        {stories.map((story) => (
          <Pressable
            key={story.kind}
            onPress={() => router.push(`/stories?start=${story.kind}` as never)}
            style={styles.item}
          >
            <View style={[styles.ring, ringTone(story.tone)]}>
              <View style={[styles.icon, iconTone(story.tone)]}>
                <Ionicons name={storyIcon(story.kind)} size={20} color="#FFFFFF" />
              </View>
              {story.kind === 'learn' && story.answered_today ? (
                <View style={styles.complete}>
                  <Ionicons name="checkmark" size={9} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
            <Text numberOfLines={1} style={styles.label}>{storyLabel(story)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function storyIcon(kind: PartnerStory['kind']) {
  if (kind === 'today') return 'sunny-outline' as const;
  if (kind === 'impact') return 'heart-outline' as const;
  if (kind === 'journey') return 'trail-sign-outline' as const;
  if (kind === 'business') return 'analytics-outline' as const;
  return 'bulb-outline' as const;
}

function storyLabel(story: PartnerStory) {
  if (story.kind === 'today') return 'Today';
  if (story.kind === 'impact') return 'Impact';
  if (story.kind === 'journey') return 'Journey';
  if (story.kind === 'business') return 'Business';
  return 'Learn';
}

function ringTone(tone: PartnerStory['tone']) {
  if (tone === 'attention') return styles.ringAttention;
  if (tone === 'impact') return styles.ringImpact;
  if (tone === 'journey') return styles.ringJourney;
  if (tone === 'business') return styles.ringBusiness;
  if (tone === 'learn') return styles.ringLearn;
  return styles.ringCalm;
}

function iconTone(tone: PartnerStory['tone']) {
  if (tone === 'attention') return styles.iconAttention;
  if (tone === 'impact') return styles.iconImpact;
  if (tone === 'journey') return styles.iconJourney;
  if (tone === 'business') return styles.iconBusiness;
  if (tone === 'learn') return styles.iconLearn;
  return styles.iconCalm;
}

const styles = StyleSheet.create({
  header: { marginTop: 19, marginBottom: 9 },
  title: { color: partnerTheme.colors.ink, fontSize: 13, fontWeight: '800' },
  rail: { flexDirection: 'row', alignItems: 'flex-start' },
  item: { flex: 1, minWidth: 0, alignItems: 'center' },
  ring: { width: 56, height: 56, borderRadius: 19, padding: 2.5, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  icon: { width: 47, height: 47, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { marginTop: 5, maxWidth: 58, color: partnerTheme.colors.inkMuted, fontSize: 7.8, fontWeight: '700', textAlign: 'center' },

  ringAttention: { borderColor: '#E5B875' },
  ringImpact: { borderColor: '#85C8C6' },
  ringJourney: { borderColor: '#A9A4F3' },
  ringBusiness: { borderColor: '#9CB1DF' },
  ringLearn: { borderColor: '#E1BD7B' },
  ringCalm: { borderColor: '#A9B8C7' },

  iconAttention: { backgroundColor: '#A5681B' },
  iconImpact: { backgroundColor: '#0F8B8D' },
  iconJourney: { backgroundColor: '#675FD4' },
  iconBusiness: { backgroundColor: '#34549C' },
  iconLearn: { backgroundColor: '#8E5F1A' },
  iconCalm: { backgroundColor: '#49627A' },

  complete: { position: 'absolute', right: -2, bottom: -2, width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: partnerTheme.colors.success, borderWidth: 2, borderColor: partnerTheme.colors.canvas },
});
