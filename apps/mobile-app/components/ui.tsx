import { Link, LinkProps, useRouter } from 'expo-router';
import { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, PressableProps, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { signOut } from '@/lib/auth';

export const colors = {
  navy: '#0B1F3A',
  navySoft: '#173B68',
  green: '#18A058',
  grey: '#6B7280',
  lightGrey: '#EEF2F6',
  border: '#D8DEE8',
  white: '#FFFFFF',
  danger: '#B42318',
};

export function Screen({ title, subtitle, children, showLogout = false }: PropsWithChildren<{ title: string; subtitle?: string; showLogout?: boolean }>) {
  const router = useRouter();
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.brandBadge}><Text style={styles.brandBadgeText}>I</Text></View>
        <View style={styles.headerText}>
          <Text style={styles.brand}>InsureIt</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {showLogout ? <Button label="Sign out" variant="secondary" onPress={() => void signOut(router)} /> : null}
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, ...props }: PropsWithChildren<PressableProps>) {
  return <Pressable style={[styles.card, typeof style === 'function' ? undefined : style]} {...props}>{children}</Pressable>;
}

export function Button({ label, onPress, variant = 'primary', disabled = false }: { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger'; disabled?: boolean }) {
  const buttonStyle = [styles.button, variant === 'secondary' && styles.secondaryButton, variant === 'danger' && styles.dangerButton, disabled && styles.disabledButton];
  const textStyle = [styles.buttonText, variant === 'secondary' && styles.secondaryButtonText];
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={buttonStyle}>
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export function TextField({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#8A94A6" style={styles.input} {...props} />
    </View>
  );
}

export function Message({ type = 'info', children }: PropsWithChildren<{ type?: 'info' | 'error' | 'success' }>) {
  return <Text style={[styles.message, type === 'error' && styles.errorMessage, type === 'success' && styles.successMessage]}>{children}</Text>;
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return <View style={styles.center}><ActivityIndicator color={colors.green} /><Text style={styles.muted}>{label}</Text></View>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return <Card><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>{body}</Text></Card>;
}

export function Row({ label, value }: { label: string; value?: string | number | null }) {
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value ?? '—'}</Text></View>;
}

export function NavLink({ href, label }: { href: LinkProps['href']; label: string }) {
  return <Link href={href} asChild><Pressable style={styles.navLink}><Text style={styles.navLinkText}>{label}</Text><Text style={styles.navChevron}>›</Text></Pressable></Link>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lightGrey },
  screenContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, marginTop: 10 },
  brandBadge: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  brandBadgeText: { color: colors.white, fontSize: 26, fontWeight: '800' },
  headerText: { flex: 1 },
  brand: { color: colors.green, fontSize: 14, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase' },
  title: { color: colors.navy, fontSize: 28, fontWeight: '800', marginTop: 2 },
  subtitle: { color: colors.grey, fontSize: 15, lineHeight: 22, marginTop: 4 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.navy, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  button: { minHeight: 50, borderRadius: 14, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginVertical: 8, paddingHorizontal: 16 },
  secondaryButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.navy },
  dangerButton: { backgroundColor: colors.danger },
  disabledButton: { opacity: 0.55 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  secondaryButtonText: { color: colors.navy },
  fieldWrap: { marginBottom: 12 },
  label: { color: colors.navy, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 14, minHeight: 50, color: colors.navy, fontSize: 16 },
  message: { color: colors.navy, backgroundColor: '#E8F1FB', borderRadius: 12, padding: 12, marginVertical: 8, lineHeight: 20 },
  errorMessage: { color: colors.danger, backgroundColor: '#FEEFEF' },
  successMessage: { color: '#067647', backgroundColor: '#EAF8F0' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  muted: { color: colors.grey, fontSize: 15, lineHeight: 22 },
  row: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 10 },
  rowLabel: { color: colors.grey, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  rowValue: { color: colors.navy, fontSize: 16, fontWeight: '600' },
  navLink: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navLinkText: { color: colors.navy, fontSize: 16, fontWeight: '800' },
  navChevron: { color: colors.green, fontSize: 26, fontWeight: '800' },
});
