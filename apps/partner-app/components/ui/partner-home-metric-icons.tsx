import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export function PartnerPoliciesSoldIcon({ size = 36 }: { size?: number }) {
  const scale = size / 36;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View
        style={[
          styles.document,
          {
            left: 8 * scale,
            top: 7 * scale,
            width: 17 * scale,
            height: 21 * scale,
            borderRadius: 4 * scale,
          },
        ]}
      />
      <View style={[styles.documentLine, { left: 11 * scale, top: 12 * scale, width: 10 * scale, height: 1.8 * scale }]} />
      <View style={[styles.documentLine, { left: 11 * scale, top: 16 * scale, width: 9 * scale, height: 1.8 * scale }]} />
      <View style={[styles.documentLine, { left: 11 * scale, top: 20 * scale, width: 7 * scale, height: 1.8 * scale }]} />
      <View
        style={[
          styles.policyBadge,
          {
            right: 4 * scale,
            bottom: 4 * scale,
            width: 14 * scale,
            height: 14 * scale,
            borderRadius: 7 * scale,
          },
        ]}
      >
        <Ionicons name="checkmark" size={8 * scale} color="#FFFFFF" />
      </View>
    </View>
  );
}

export function PartnerCommissionEarnedIcon({ size = 36 }: { size?: number }) {
  const scale = size / 36;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { width: size, height: size, borderRadius: size / 2 }]}
    >
      <View
        style={[
          styles.coinBottom,
          {
            left: 8 * scale,
            top: 19 * scale,
            width: 20 * scale,
            height: 8 * scale,
            borderRadius: 4 * scale,
          },
        ]}
      />
      <View
        style={[
          styles.coinMiddle,
          {
            left: 10 * scale,
            top: 14 * scale,
            width: 18 * scale,
            height: 8 * scale,
            borderRadius: 4 * scale,
          },
        ]}
      />
      <View
        style={[
          styles.coinTop,
          {
            left: 12 * scale,
            top: 9 * scale,
            width: 16 * scale,
            height: 8 * scale,
            borderRadius: 4 * scale,
          },
        ]}
      />
      <View
        style={[
          styles.coinHighlight,
          {
            left: 15 * scale,
            top: 11.5 * scale,
            width: 7 * scale,
            height: 1.6 * scale,
            borderRadius: 1 * scale,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDF7FF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDEFFF',
  },
  document: {
    position: 'absolute',
    backgroundColor: '#176FD0',
  },
  documentLine: {
    position: 'absolute',
    borderRadius: 1,
    backgroundColor: '#CFE8FF',
  },
  policyBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B82E6',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  coinBottom: {
    position: 'absolute',
    backgroundColor: '#176FD0',
  },
  coinMiddle: {
    position: 'absolute',
    backgroundColor: '#2688DE',
  },
  coinTop: {
    position: 'absolute',
    backgroundColor: '#4AA2E8',
  },
  coinHighlight: {
    position: 'absolute',
    backgroundColor: '#CFEAFF',
  },
});
