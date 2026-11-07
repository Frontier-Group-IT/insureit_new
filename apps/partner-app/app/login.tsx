import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';

import { PartnerButton } from '@/components/ui/partner-button';
import { PartnerField } from '@/components/ui/partner-field';
import { partnerTheme } from '@/lib/theme';
import { signIn } from '@/lib/partner-session';
import { usePartnerSession } from '@/providers/partner-session-provider';

export default function LoginScreen() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const entrance = useRef(new Animated.Value(0)).current;
  const floating = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(floating, { toValue: 1, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floating, { toValue: 0, duration: 5000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    motion.start();
    return () => motion.stop();
  }, [entrance, floating]);
  const { refresh } = usePartnerSession();
  const scrollRef = useRef<ScrollView>(null);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function revealFormEnd() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  async function submit() {
    if (!email.trim() || !password) {
      setMessage('Enter your registered email and password.');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await signIn(email, password);
      const context = await refresh();
      if (!context) throw new Error('Partner access unavailable.');
      router.replace('/(tabs)');
    } catch {
      setMessage('We could not open your Partner account. Check your credentials or contact INSUREIT support.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      accessibilityLabel="INSUREIT Partner sign in"
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View pointerEvents="none" style={styles.background}>
        <Animated.View style={[styles.topWave, { transform: [{ translateY: floating.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) }] }]} />
        <View style={styles.topWaveLight} />
        <Animated.View style={[styles.bottomWave, { transform: [{ translateY: floating.interpolate({ inputRange: [0, 1], outputRange: [8, -8] }) }] }]} />
        <View style={styles.bottomWaveLight} />
        <View style={styles.shieldWatermark}><MaterialCommunityIcons name="shield-check-outline" size={174} color="#BADCF8" /></View>
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.content, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] }]}>
        <View style={[styles.brandBlock, height < 690 && styles.brandCompact]}>
          <Image
            accessibilityLabel="INSUREIT Partner app logo"
            source={require('../assets/partner-app-icon.jpg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>insureit</Text>
          <View style={styles.partnerLabelRow}><View style={styles.partnerDivider} /><Text style={styles.brandPartner}>PARTNER</Text><View style={styles.partnerDivider} /></View>
          <Text style={styles.tagline}>YOUR SAFETY, OUR PROMISE</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.welcomeRow}><MaterialCommunityIcons name="handshake-outline" size={32} color="#0757AC" /><Text accessibilityRole="header" style={styles.title}>Welcome back</Text></View>
          <Text style={styles.subtitle}>Sign in with your registered Partner or employee account.</Text>

          <View style={styles.field}>
            <PartnerField
              label="Email"
              hideLabel
              leftAccessory={<MaterialCommunityIcons name="email-outline" size={21} color="#0757AC" />}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (message) setMessage('');
              }}
              editable={!busy}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              importantForAutofill="no"
              textContentType="username"
              placeholder="Email"
              style={styles.loginInput}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => {
                passwordRef.current?.focus();
                revealFormEnd();
              }}
            />
          </View>

          <View style={styles.field}>
            <PartnerField
              ref={passwordRef}
              label="Password"
              hideLabel
              leftAccessory={<MaterialCommunityIcons name="lock-outline" size={21} color="#0757AC" />}
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (message) setMessage('');
              }}
              editable={!busy}
              secureTextEntry={!passwordVisible}
              autoComplete="current-password"
              importantForAutofill="no"
              textContentType="password"
              placeholder="Enter password"
              style={styles.loginInput}
              returnKeyType="done"
              onFocus={revealFormEnd}
              onSubmitEditing={() => {
                if (!busy) void submit();
              }}
              rightAccessory={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  onPress={() => setPasswordVisible((current) => !current)}
                  style={styles.eyeButton}
                >
                  <MaterialCommunityIcons
                    name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                    size={21}
                    color={partnerTheme.colors.inkMuted}
                  />
                </Pressable>
              }
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            disabled={busy}
            onPress={() => router.push('/forgot-password')}
            style={styles.forgotPassword}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </Pressable>

          {message ? (
            <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
              {message}
            </Text>
          ) : null}

          <View style={styles.button}>
            <PartnerButton
              label="Sign in"
              backgroundColor="#0866D9"
              pressedBackgroundColor="#082D70"
              loading={busy}
              disabled={busy}
              onPress={() => void submit()}
              trailing={<MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />}
            />
          </View>
        </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#E9F6FF' },
  background: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: '#EAF6FF' },
  topWave: { position: 'absolute', top: -280, left: -220, width: 530, height: 410, borderRadius: 265, backgroundColor: '#0458A6', transform: [{ rotate: '-24deg' }] },
  topWaveLight: { position: 'absolute', top: -295, left: -140, width: 500, height: 355, borderRadius: 220, backgroundColor: '#73B8EF', opacity: 0.38, transform: [{ rotate: '-25deg' }] },
  bottomWave: { position: 'absolute', bottom: -240, right: -210, width: 530, height: 380, borderRadius: 270, backgroundColor: '#0B65AD', transform: [{ rotate: '-24deg' }] },
  bottomWaveLight: { position: 'absolute', bottom: -205, right: -110, width: 520, height: 345, borderRadius: 250, backgroundColor: '#88CBFC', opacity: 0.65, transform: [{ rotate: '-24deg' }] },
  shieldWatermark: { position: 'absolute', right: -35, top: 126, opacity: 0.42 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 25, paddingTop: 30, paddingBottom: 40 },
  content: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  brandBlock: { alignItems: 'center', marginBottom: 30 },
  brandCompact: { marginBottom: 18 },
  logo: { width: 98, height: 98, borderRadius: 26, marginBottom: 10 },
  brandName: { fontSize: 49, fontWeight: '900', color: '#07162D', letterSpacing: -2.2, lineHeight: 54 },
  partnerLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 2 },
  partnerDivider: { height: 1, width: 36, backgroundColor: '#287BBB' },
  brandPartner: { fontSize: 17, fontWeight: '700', letterSpacing: 6.5, color: '#1258A2' },
  tagline: { fontSize: 11, fontWeight: '800', letterSpacing: 2.7, color: '#5A6C80', marginTop: 12, textAlign: 'center' },
  card: { borderRadius: 32, padding: 25, backgroundColor: 'rgba(255,255,255,0.97)', borderColor: '#FFFFFF', borderWidth: 1, shadowColor: '#135FAD', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 9 },
  welcomeRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 12 },
  title: { fontSize: 29, fontWeight: '800', letterSpacing: -0.9, color: '#071832' },
  subtitle: { fontSize: 13, lineHeight: 20, color: '#576578', textAlign: 'center', marginTop: 12, marginBottom: 21 },
  field: { marginTop: 15, position: 'relative' },
  loginInput: { minHeight: 56, backgroundColor: '#F0F4FA', borderColor: '#DCE5F0', borderRadius: 17, color: '#0A1B33', fontSize: 15 },
  eyeButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  forgotPassword: { alignSelf: 'flex-end', marginTop: 15, paddingVertical: 7, paddingLeft: 12 },
  forgotPasswordText: { color: '#0758AA', fontSize: 13, fontWeight: '700' },
  error: { marginTop: 13, color: partnerTheme.colors.danger, ...partnerTheme.typography.caption },
  button: { marginTop: 18 },
});