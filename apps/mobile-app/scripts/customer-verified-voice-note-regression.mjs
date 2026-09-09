import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const componentPath = path.join(root, 'apps/mobile-app/components/incident-voice-note.tsx');
const stagePath = path.join(root, 'apps/mobile-app/components/internal-claim-stage-one-tracker.tsx');

const component = fs.readFileSync(componentPath, 'utf8');
const stage = fs.readFileSync(stagePath, 'utf8');

const checks = [
  ['Claims Desk verification remains the source of truth', stage.includes("const voiceVerified = voiceDocument?.verification_status === 'verified'")],
  ['Verified state is still passed to the voice-note component', stage.includes('saved={voiceVerified}')],
  ['Verified voice note uses the green locked card treatment', component.includes('locked = saved') && component.includes('locked && styles.cardLocked') && component.includes("cardLocked: { borderColor: '#52B57F', backgroundColor: '#EFFAF4' }")],
  ['Verified voice note shows a lock icon on the card', component.includes('locked ? <View style={styles.lockBadge}><MaterialCommunityIcons name="lock-check-outline"')],
  ['Voice note ready row owns play and pause behaviour', component.includes('onPress={() => void togglePlayback()}') && component.includes("accessibilityLabel={playerState.playing ? 'Pause voice note' : 'Play voice note'}") && component.includes('<Text style={styles.readyText}>Voice note ready</Text>')],
  ['Standalone Play action has been removed', !component.includes("<Text style={styles.secondaryText}>{playerState.playing ? 'Pause' : 'Play'}</Text>")),
  ['Verified voice notes do not render Delete or Re-record actions', component.includes('{!locked ? (') && component.includes('accessibilityLabel="Delete voice note"') && component.includes('accessibilityLabel="Record voice note again"')],
  ['Verified voice notes remain protected in the parent handlers', stage.includes('if (voiceVerified) {') && stage.includes('can no longer be replaced') && stage.includes('can no longer be deleted')],
  ['No claim persistence or verification backend contract was added to the presentation component', !component.includes("from('claim_documents')") && !component.includes('supabase')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);

if (failed.length) {
  console.error(`\n${failed.length} verified voice-note regression check(s) failed.`);
  process.exit(1);
}

console.log('\nCustomer verified voice-note regression passed.');
