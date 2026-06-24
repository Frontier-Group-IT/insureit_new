import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, ImageStyle, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

const stitchLogo = require('../assets/brand/insureit-stitch-logo.png');

export function BrandMark({ size = 52, compact = false }: { size?: number; compact?: boolean }) {
  void compact;
  return (
    <View style={[styles.nativeMark, { width: size, height: size, borderRadius: Math.round(size * 0.24) }]}>
      <MaterialCommunityIcons name="shield-check-outline" size={Math.round(size * 0.62)} color="#071D49" />
      <View style={styles.nativeMarkDot} />
    </View>
  );
}
export function BrandLogo({ width = 208, style }: { width?: number; style?: ImageStyle }) {
  return <Image source={stitchLogo} resizeMode="contain" style={[styles.stitchLogo, { width, height: Math.round(width * 0.389) }, style]} />;
}

export function SplashIntro() {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const route = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 10, bounciness: 5 }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const routeLoop = Animated.loop(Animated.timing(route, { toValue: 1, duration: 1550, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    loop.start();
    routeLoop.start();
    return () => { loop.stop(); routeLoop.stop(); };
  }, [opacity, pulse, route, scale]);

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.1] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.45] });
  const routeX = route.interpolate({ inputRange: [0, 1], outputRange: [-82, 150] });
  const routeRotate = route.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.splashScreen}>
      <View style={styles.splashSky} />
      <View style={styles.splashAuroraTop} />
      <View style={styles.splashAuroraBottom} />
      <Animated.View style={[styles.splashHalo, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
      <Animated.View style={[styles.splashContent, { opacity, transform: [{ scale }] }]}>
        <View style={styles.splashLogoCard}><BrandLogo width={210} /></View>
        <Text style={styles.splashTagline}>Protection that keeps moving.</Text>
        <View style={styles.splashLoaderScene}>
          <Animated.View style={[styles.splashLoaderRing, { transform: [{ rotate: routeRotate }] }]} />
          <View style={styles.splashLoaderCore}><MaterialCommunityIcons name="shield-check-outline" size={32} color="#087F5B" /></View>
        </View>
        <View style={styles.splashRouteTrack}><Animated.View style={[styles.splashRoutePulse, { transform: [{ translateX: routeX }] }]} /></View>
        <View style={styles.splashLoadingRow}><View style={styles.splashLoadingDot} /><Text style={styles.splashLoadingText}>Preparing your InsureIT experience</Text></View>
      </Animated.View>
    </View>
  );
}

export function SignalScene({ active = false, showLogo = true }: { active?: boolean; showLogo?: boolean }) {
  const route = useRef(new Animated.Value(0)).current;
  const truckOne = useRef(new Animated.Value(0)).current;
  const truckTwo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const routeLoop = Animated.loop(Animated.timing(route, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }));
    const movingTruckLoops = [
      startTruckLoop(truckOne, 6800, 0),
      startTruckLoop(truckTwo, 7600, 4200),
    ];
    routeLoop.start();
    return () => {
      routeLoop.stop();
      movingTruckLoops.forEach((loop) => loop.stop());
    };
  }, [route, truckOne, truckTwo]);

  const signalX = route.interpolate({ inputRange: [0, 1], outputRange: [-90, 320] });
  const signalOpacity = route.interpolate({ inputRange: [0, 0.18, 0.82, 1], outputRange: [0, 0.62, 0.62, 0] });
  const truckOneX = truckOne.interpolate({ inputRange: [0, 1], outputRange: [-170, 430] });
  const truckTwoX = truckTwo.interpolate({ inputRange: [0, 1], outputRange: [-190, 410] });

  return (
    <View style={styles.scene}>
      {showLogo ? <BrandLogo width={232} style={styles.sceneLogo} /> : null}
      <View style={styles.scenePromo}>
        <View style={styles.scenePromoPill}>
          <MaterialCommunityIcons name="shield-check-outline" size={13} color="#1363DF" />
          <Text style={styles.scenePromoPillText}>Commercial Insurance Assistance</Text>
        </View>
        <Text style={styles.scenePromoTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82}>Compare quotes before renewal</Text>
        <Text style={styles.scenePromoSubtitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.9}>Choose the right cover with assisted support</Text>
        <View style={styles.scenePromoBenefits}>
          <View style={styles.scenePromoBenefit}>
            <MaterialCommunityIcons name="shield-star-outline" size={15} color="#F5A524" />
            <Text style={styles.scenePromoBenefitText}>Multiple{'\n'}insurers</Text>
          </View>
          <View style={styles.scenePromoBenefit}>
            <MaterialCommunityIcons name="shield-check-outline" size={15} color="#0F9F6E" />
            <Text style={styles.scenePromoBenefitText}>Expert{'\n'}assistance</Text>
          </View>
          <View style={styles.scenePromoBenefit}>
            <MaterialCommunityIcons name="file-document-outline" size={15} color="#1363DF" />
            <Text style={styles.scenePromoBenefitText}>Quick &{'\n'}transparent</Text>
          </View>
        </View>
      </View>
      <View style={styles.sceneCloudA} />
      <View style={styles.sceneCloudB} />
      <View style={styles.sceneRoadFar} />
      <View style={styles.sceneRoadMain} />
      <View style={styles.sceneRoadGreen} />
      <View style={styles.sceneRoadEdge} />
      <Animated.View style={[styles.routePulse, { opacity: signalOpacity, transform: [{ translateX: signalX }] }]} />
      <Animated.View style={[styles.movingTruck, styles.movingTruckNear, { transform: [{ translateX: truckOneX }] }]}>
        <CommercialTruck cabColor="#F5A524" bodyColor="#44546A" compact reverse />
      </Animated.View>
      <Animated.View style={[styles.movingTruck, styles.movingTruckMid, { transform: [{ translateX: truckTwoX }, { scale: 0.78 }] }]}>
        <CommercialTruck cabColor="#1363DF" bodyColor="#FFFFFF" compact reverse />
      </Animated.View>
      {active ? <View style={styles.sceneActiveDot} /> : null}
    </View>
  );
}

function startTruckLoop(value: Animated.Value, duration: number, delay: number) {
  const loop = Animated.loop(
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]),
  );
  loop.start();
  return loop;
}

function CommercialTruck({ cabColor, bodyColor, compact = false, reverse = false }: { cabColor: string; bodyColor: string; compact?: boolean; reverse?: boolean }) {
  return (
    <View style={[styles.vehicleShape, compact && styles.vehicleShapeCompact, reverse && styles.vehicleShapeReverse]}>
      <View style={[styles.vehicleCab, { backgroundColor: cabColor }]}>
        <View style={styles.vehicleGlass} />
      </View>
      <View style={[styles.vehicleBody, { backgroundColor: bodyColor }]}>
        <View style={styles.vehicleLine} />
      </View>
      <View style={styles.vehicleWheelLeft} />
      <View style={styles.vehicleWheelRight} />
    </View>
  );
}

export function PremiumLoginField({ label, icon, disabled = false, secureTextEntry, ...props }: TextInputProps & { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; disabled?: boolean }) {
  const [visible, setVisible] = useState(false);
  const isSecure = Boolean(secureTextEntry);
  return (
    <View style={[styles.fieldWrap, disabled && styles.fieldDisabled]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <MaterialCommunityIcons name={icon} size={20} color="#1F6FEB" />
        <TextInput placeholderTextColor="#8292AA" style={styles.input} secureTextEntry={isSecure && !visible} {...props} />
        {isSecure ? (
          <Pressable accessibilityRole="button" onPress={() => setVisible((current) => !current)} style={styles.passwordButton}>
            <MaterialCommunityIcons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="#8290A3" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SecureActionButton({ label, icon = 'login', loading = false, disabled = false, variant = 'primary', onPress }: { label: string; icon?: keyof typeof MaterialCommunityIcons.glyphMap; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'success' | 'secondary' | 'ghost'; onPress: () => void }) {
  const style = [styles.secureButton, variant === 'success' && styles.secureSuccess, variant === 'secondary' && styles.secureSecondary, variant === 'ghost' && styles.secureGhost, (disabled || loading) && styles.secureDisabled];
  const textStyle = [styles.secureButtonText, (variant === 'secondary' || variant === 'ghost') && styles.secureSecondaryText];
  const iconColor = variant === 'primary' || variant === 'success' ? '#FFFFFF' : '#075EEA';
  return (
    <Pressable accessibilityRole="button" disabled={disabled || loading} onPress={onPress} style={style}>
      {loading ? <ActivityIndicator color={iconColor} /> : <MaterialCommunityIcons name={icon} size={20} color={iconColor} />}
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

export function AuthStatusMessage({ type = 'info', children }: { type?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const isError = type === 'error';
  const isSuccess = type === 'success';
  return (
    <View style={[styles.authMessage, isError && styles.authMessageError, isSuccess && styles.authMessageSuccess]}>
      <MaterialCommunityIcons name={isError ? 'alert-circle-outline' : isSuccess ? 'check-circle-outline' : 'information-outline'} size={18} color={isError ? '#E5484D' : isSuccess ? '#0F9F6E' : '#1F6FEB'} />
      <Text style={[styles.authMessageText, isError && styles.authMessageErrorText, isSuccess && styles.authMessageSuccessText]}>{children}</Text>
    </View>
  );
}

export function AuthGlassPanel({ children }: { children: ReactNode }) {
  return <View style={styles.authPanel}>{children}</View>;
}

const styles = StyleSheet.create({
  nativeMark: { backgroundColor: '#F4F8FC', borderWidth: 1, borderColor: '#C9DCF0', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  nativeMarkDot: { position: 'absolute', right: 8, top: 8, width: 6, height: 6, borderRadius: 3, backgroundColor: '#C98918' },
  stitchLogo: { alignSelf: 'flex-start' },
  logoShield: { backgroundColor: '#F4F8FC', borderWidth: 1, borderColor: '#C9DCF0', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  logoAmberDot: { position: 'absolute', width: 5, height: 5, borderRadius: 3, right: 4, top: 5, backgroundColor: '#C98918' },
  logoWord: { color: '#071D49', fontFamily: 'serif', fontWeight: '700', includeFontPadding: false },
  splashScreen: { flex: 1, backgroundColor: '#F4F9FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  splashSky: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F4F9FF' },
  splashAuroraTop: { position: 'absolute', top: -170, right: -130, width: 390, height: 390, borderRadius: 195, backgroundColor: '#D8EBFF' },
  splashAuroraBottom: { position: 'absolute', bottom: -170, left: -150, width: 410, height: 300, borderRadius: 180, backgroundColor: '#DDF6EC', transform: [{ rotateZ: '-12deg' }] },
  splashHalo: { position: 'absolute', width: 248, height: 248, borderRadius: 124, backgroundColor: 'rgba(134, 217, 192, 0.42)' },
  splashContent: { alignItems: 'center', width: '100%', paddingHorizontal: 28 },
  splashLogoCard: { width: 244, height: 112, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.9)', borderWidth: 1, borderColor: '#D7E6F5', alignItems: 'center', justifyContent: 'center', shadowColor: '#0B3769', shadowOpacity: 0.09, shadowRadius: 22, elevation: 5 },
  splashTagline: { color: '#52647B', fontSize: 13, fontWeight: '800', marginTop: 15, letterSpacing: 0.1 },
  splashLoaderScene: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', marginTop: 38 },
  splashLoaderRing: { position: 'absolute', width: 96, height: 96, borderRadius: 48, borderWidth: 5, borderColor: '#D2E6DD', borderTopColor: '#087F5B', borderRightColor: '#4DBB94' },
  splashLoaderCore: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCE8F4', alignItems: 'center', justifyContent: 'center', shadowColor: '#0B3769', shadowOpacity: 0.13, shadowRadius: 12, elevation: 4 },
  splashRouteTrack: { width: 166, height: 7, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(11,99,206,0.14)', marginTop: 18 },
  splashRoutePulse: { width: 70, height: 7, borderRadius: 99, backgroundColor: '#0B63CE', shadowColor: '#0B63CE', shadowOpacity: 0.55, shadowRadius: 8 },
  splashLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 13 },
  splashLoadingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#087F5B' },
  splashLoadingText: { color: '#344B67', fontSize: 11.5, fontWeight: '800' },
  scene: { height: 312, marginHorizontal: -16, marginTop: -2, backgroundColor: '#EAF5FF', overflow: 'hidden' },
  sceneLogo: { position: 'absolute', top: 52, alignSelf: 'center', zIndex: 5 },
  scenePromo: { position: 'absolute', left: 18, right: 18, top: 22, zIndex: 8, alignItems: 'center' },
  scenePromoPill: { alignSelf: 'center', minHeight: 28, borderRadius: 999, borderWidth: 1, borderColor: '#BFD8FF', backgroundColor: 'rgba(255,255,255,0.62)', paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  scenePromoPillText: { color: '#1363DF', fontSize: 11, fontWeight: '700' },
  scenePromoTitle: { color: '#0C0E1E', fontSize: 24, lineHeight: 28, fontWeight: '900', marginTop: 13, letterSpacing: 0, textAlign: 'center', alignSelf: 'stretch' },
  scenePromoSubtitle: { color: '#59687A', fontSize: 13, lineHeight: 18, fontWeight: '600', marginTop: 8, textAlign: 'center', alignSelf: 'stretch' },
  scenePromoBenefits: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, marginTop: 18, alignSelf: 'stretch' },
  scenePromoBenefit: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  scenePromoBenefitText: { color: '#324155', fontSize: 9, lineHeight: 11, fontWeight: '700' },
  sceneCloudA: { position: 'absolute', left: -44, right: -24, top: 126, height: 62, borderRadius: 70, backgroundColor: '#FFFFFF', transform: [{ rotateZ: '-6deg' }] },
  sceneCloudB: { position: 'absolute', left: 130, right: -88, top: 146, height: 58, borderRadius: 70, backgroundColor: '#CDE7FF', opacity: 0.82, transform: [{ rotateZ: '-11deg' }] },
  sceneRoadFar: { position: 'absolute', left: -28, right: -72, bottom: 88, height: 34, backgroundColor: '#FFFFFF', transform: [{ rotateZ: '-8deg' }] },
  sceneRoadMain: { position: 'absolute', left: -52, right: -60, bottom: 45, height: 52, backgroundColor: '#54C8D5', transform: [{ rotateZ: '-2deg' }] },
  sceneRoadGreen: { position: 'absolute', left: 102, right: -84, bottom: 30, height: 42, borderRadius: 46, backgroundColor: '#67D6BA', transform: [{ rotateZ: '-10deg' }] },
  sceneRoadEdge: { position: 'absolute', left: -12, right: -20, bottom: 82, height: 2, backgroundColor: 'rgba(6, 117, 234, 0.16)' },
  routePulse: { position: 'absolute', top: 202, left: 20, width: 78, height: 9, borderRadius: 999, backgroundColor: '#FFFFFF', shadowColor: '#FFFFFF', shadowOpacity: 0.6, shadowRadius: 14 },
  sceneVehicle: { position: 'absolute', right: 36, top: 178, width: 146, height: 68 },
  sceneHeroVehicle: { opacity: 0.95 },
  movingTruck: { position: 'absolute', left: 0, width: 128, height: 58 },
  movingTruckNear: { bottom: 42 },
  movingTruckMid: { bottom: 68, opacity: 0.88 },
  movingTruckFar: { bottom: 100, opacity: 0.62 },
  vehicleShape: { width: 146, height: 68, flexDirection: 'row', alignItems: 'flex-end' },
  vehicleShapeCompact: { width: 118, height: 56 },
  vehicleShapeReverse: { transform: [{ scaleX: -1 }] },
  vehicleCab: { width: 52, height: 50, borderRadius: 14, backgroundColor: '#1B7FE8', padding: 8, shadowColor: '#0B63CE', shadowOpacity: 0.18, shadowRadius: 8 },
  vehicleGlass: { width: 25, height: 15, borderRadius: 5, backgroundColor: '#BEE2FF', alignSelf: 'flex-end' },
  vehicleBody: { flex: 1, height: 48, borderTopRightRadius: 15, borderBottomRightRadius: 15, backgroundColor: '#F8FCFF', padding: 8, justifyContent: 'center', borderWidth: 1, borderColor: '#BFD8FF' },
  vehicleLine: { width: 54, height: 4, borderRadius: 2, backgroundColor: '#CFE4FF', marginBottom: 5 },
  vehicleWheelLeft: { position: 'absolute', left: 35, bottom: -6, width: 19, height: 19, borderRadius: 10, backgroundColor: '#17202F', borderWidth: 4, borderColor: '#DDE7F0' },
  vehicleWheelRight: { position: 'absolute', right: 22, bottom: -6, width: 19, height: 19, borderRadius: 10, backgroundColor: '#17202F', borderWidth: 4, borderColor: '#DDE7F0' },
  sceneActiveDot: { position: 'absolute', right: 28, top: 24, width: 12, height: 12, borderRadius: 6, backgroundColor: '#0F9F6E', shadowColor: '#0F9F6E', shadowOpacity: 0.55, shadowRadius: 12 },
  authPanel: { borderRadius: 27, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E9EEF4', paddingHorizontal: 22, paddingTop: 20, paddingBottom: 20, marginTop: 0, shadowColor: '#17202F', shadowOpacity: 0.13, shadowRadius: 22, elevation: 8 },
  fieldWrap: { marginBottom: 14 },
  fieldDisabled: { opacity: 0.55 },
  fieldLabel: { color: '#17202F', fontSize: 14.2, fontWeight: '800', marginBottom: 8 },
  inputShell: { minHeight: 58, borderRadius: 13, borderWidth: 1, borderColor: '#E1E6ED', backgroundColor: '#FFFFFF', paddingLeft: 15, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 14 },
  input: { flex: 1, color: '#17202F', fontSize: 15.2, fontWeight: '700', minHeight: 52 },
  passwordButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  secureButton: { minHeight: 60, borderRadius: 13, backgroundColor: '#071D49', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, marginTop: 12, shadowColor: '#071D49', shadowOpacity: 0.24, shadowRadius: 14, elevation: 4 },
  secureSuccess: { backgroundColor: '#0F9F6E', shadowColor: '#0F9F6E' },
  secureSecondary: { backgroundColor: '#F5F9FF', borderWidth: 1, borderColor: '#CFE4FF', shadowOpacity: 0, marginTop: 12 },
  secureGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#DDE7F0', shadowOpacity: 0 },
  secureDisabled: { opacity: 0.65 },
  secureButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  secureSecondaryText: { color: '#071D49' },
  authMessage: { borderRadius: 17, backgroundColor: '#EAF3FF', borderWidth: 1, borderColor: '#BFD8FF', padding: 11, marginBottom: 11, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  authMessageError: { backgroundColor: '#FDEEEF', borderColor: '#F5C2C4' },
  authMessageSuccess: { backgroundColor: '#E8F8F0', borderColor: '#B8E8D0' },
  authMessageText: { flex: 1, color: '#17202F', fontSize: 13, fontWeight: '500', lineHeight: 18 },
  authMessageErrorText: { color: '#B4232A' },
  authMessageSuccessText: { color: '#067647' },
});
