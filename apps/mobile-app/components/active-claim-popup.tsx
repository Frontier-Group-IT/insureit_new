import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export function ActiveClaimPopup({
  visible,
  onViewClaim,
  onCancel,
}: {
  visible: boolean;
  onViewClaim: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name="alert-outline" size={24} color="#E66A4E" />
          </View>
          <Text style={styles.title}>Claim already in progress</Text>
          <Text style={styles.body}>An active claim already exists for this policy.</Text>
          <Pressable accessibilityRole="button" onPress={onViewClaim} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>View Existing Claim</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 24, 50, 0.58)',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#071D49',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  icon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#FFF0E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    color: '#081D49',
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  body: {
    color: '#667085',
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#07327B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#9CB6DA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#07327B',
    fontSize: 13,
    fontWeight: '900',
  },
});
