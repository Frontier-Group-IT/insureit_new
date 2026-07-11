import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, Screen } from '@/components/ui';
import { palette, roleTheme } from '@/lib/theme';
import type { LegalDocument } from '@/lib/legal-content';

type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string };

export function LegalPage({ document, chrome = 'customer' }: { document: LegalDocument; chrome?: 'customer' | 'auth' }) {
  const router = useRouter();
  const blocks = parseMarkdown(document.markdown);
  const titleBlock = blocks.find((block) => block.type === 'heading' && block.level === 1);
  const contentBlocks = stripTopLegalDetails(blocks.filter((block) => block !== titleBlock));
  const introBlocks = contentBlocks.filter((block) => block.type !== 'heading').slice(0, 3);
  const remainingBlocks = contentBlocks.slice(introBlocks.length);

  const content = (
    <>
      <Text style={styles.pageName}>{document.title}</Text>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.effective}>{metaLine(document.markdown) ?? 'Sankalp Insurance Brokers Private Limited'}</Text>
          {introBlocks.map((block, index) => <MarkdownLine key={`intro-${index}`} block={block} intro />)}
        </View>
      </View>

      <Card style={styles.documentCard}>
        {remainingBlocks.map((block, index) => <MarkdownLine key={`${block.type}-${index}-${block.text.slice(0, 16)}`} block={block} />)}
      </Card>

      {chrome === 'customer' ? (
        <View style={styles.assistanceCard}>
        <View style={styles.assistanceIcon}>
          <MaterialCommunityIcons name="headset" size={21} color="#FFFFFF" />
        </View>
        <View style={styles.assistanceCopy}>
          <Text style={styles.assistanceTitle}>Need clarification?</Text>
          <Text style={styles.assistanceBody}>Our support team can help with legal, policy, account, and claim questions.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/customer/support')} style={styles.assistanceButton}>
          <MaterialCommunityIcons name="arrow-right" size={17} color={roleTheme.customer.accent} />
        </Pressable>
      </View>
      ) : null}
    </>
  );

  if (chrome === 'auth') {
    return (
      <SafeAreaView style={styles.authSafeArea}>
        <ScrollView
          style={styles.authScreen}
          contentContainerStyle={styles.authContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authTopBar}>
            <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.authBackButton}>
              <MaterialCommunityIcons name="chevron-left" size={24} color={palette.ink} />
            </Pressable>
            <Text style={styles.authTopTitle}>Legal</Text>
            <View style={styles.authBackButtonPlaceholder} />
          </View>
          {content}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <Screen title={document.title} showTitleHeader={false}>
      {content}
    </Screen>
  );
}

function MarkdownLine({ block, intro = false }: { block: MarkdownBlock; intro?: boolean }) {
  if (block.type === 'heading') {
    if (block.level === 2) return <Text style={styles.headingTwo}>{block.text}</Text>;
    return <Text style={styles.headingThree}>{block.text}</Text>;
  }

  if (block.type === 'bullet') {
    return (
      <View style={styles.bulletRow}>
        <View style={styles.bulletDot} />
        <Text style={styles.bulletText}>{renderInline(block.text)}</Text>
      </View>
    );
  }

  return <Text style={intro ? styles.introText : styles.paragraph}>{renderInline(block.text)}</Text>;
}

function renderInline(text: string) {
  const parts = cleanText(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    const bold = part.startsWith('**') && part.endsWith('**');
    const content = bold ? part.slice(2, -2) : part;
    return <Text key={`${content}-${index}`} style={bold ? styles.boldText : undefined}>{content}</Text>;
  });
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
    paragraph = [];
  }

  markdown.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      return;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      blocks.push({ type: 'heading', level: 3, text: cleanText(line.slice(4)) });
      return;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      blocks.push({ type: 'heading', level: 2, text: cleanText(line.slice(3)) });
      return;
    }
    if (line.startsWith('# ')) {
      flushParagraph();
      blocks.push({ type: 'heading', level: 1, text: cleanText(line.slice(2)) });
      return;
    }
    if (line.startsWith('- ')) {
      flushParagraph();
      blocks.push({ type: 'bullet', text: line.slice(2) });
      return;
    }
    paragraph.push(line);
  });

  flushParagraph();
  return blocks;
}

function stripTopLegalDetails(blocks: MarkdownBlock[]) {
  const nextBlocks: MarkdownBlock[] = [];
  let index = 0;
  let skippingCompanyDetails = false;

  while (index < blocks.length) {
    const block = blocks[index];
    const text = cleanText(block.text).toLowerCase();

    if (index < 8 && block.type === 'paragraph' && (text.includes('effective date') || text.includes('last updated'))) {
      index += 1;
      continue;
    }

    if (index < 12 && block.type === 'paragraph' && (text.includes('company legal details') || text.startsWith('**company:**') || text.startsWith('company:'))) {
      skippingCompanyDetails = true;
      index += 1;
      continue;
    }

    if (skippingCompanyDetails && block.type === 'bullet') {
      index += 1;
      continue;
    }

    if (block.type === 'bullet' && index < 12 && isTopLegalMetadata(text)) {
      index += 1;
      continue;
    }

    skippingCompanyDetails = false;
    nextBlocks.push(block);
    index += 1;
  }

  return nextBlocks;
}

function isTopLegalMetadata(text: string) {
  return text.includes('**cin:**')
    || text.includes('**roc:**')
    || text.includes('**company status:**')
    || text.includes('**registered office:**');
}

function metaLine(markdown: string) {
  const effective = markdown.split('\n').find((line) => line.toLowerCase().includes('effective date'));
  return effective ? cleanText(effective.replace(/\*\*/g, '').replace(/:/g, ': ')).replace(/\s+/g, ' ') : null;
}

function cleanText(text: string) {
  return text
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€“/g, '-')
    .replace(/â€”/g, '-')
    .replace(/\s+$/g, '')
    .trim();
}

const styles = StyleSheet.create({
  authSafeArea: { flex: 1, backgroundColor: '#EEF7FF' },
  authScreen: { flex: 1 },
  authContent: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 26 },
  authTopBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  authBackButton: { width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(191,216,255,0.78)' },
  authBackButtonPlaceholder: { width: 40, height: 40 },
  authTopTitle: { color: palette.ink, fontSize: 15, fontWeight: '800' },
  pageName: { color: palette.navy, fontSize: 15, lineHeight: 19, fontWeight: '900', marginBottom: 9 },
  hero: { borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#CFE0FF', padding: 13, marginBottom: 10, overflow: 'hidden' },
  heroCopy: { flex: 1, minWidth: 0 },
  effective: { color: roleTheme.customer.accent, fontSize: 11, lineHeight: 15, fontWeight: '900', textTransform: 'uppercase' },
  introText: { color: palette.ink, fontSize: 12.5, lineHeight: 18, fontWeight: '700', marginTop: 6 },
  documentCard: { padding: 15 },
  headingTwo: { color: palette.navy, fontSize: 17, lineHeight: 22, fontWeight: '900', marginTop: 15, marginBottom: 8 },
  headingThree: { color: palette.ink, fontSize: 14.5, lineHeight: 20, fontWeight: '900', marginTop: 12, marginBottom: 6 },
  paragraph: { color: palette.slate, fontSize: 12.5, lineHeight: 19, fontWeight: '600', marginBottom: 9 },
  boldText: { color: palette.ink, fontWeight: '900' },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 7 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: roleTheme.customer.accent, marginTop: 7 },
  bulletText: { color: palette.slate, fontSize: 12.5, lineHeight: 19, fontWeight: '600', flex: 1 },
  assistanceCard: { borderRadius: 20, backgroundColor: palette.navy, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 2 },
  assistanceIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  assistanceCopy: { flex: 1, minWidth: 0 },
  assistanceTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  assistanceBody: { color: 'rgba(255,255,255,0.74)', fontSize: 11.5, lineHeight: 16, fontWeight: '700', marginTop: 3 },
  assistanceButton: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
