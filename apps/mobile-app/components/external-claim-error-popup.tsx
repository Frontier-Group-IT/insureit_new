import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export function ExternalClaimErrorPopup({
  message,
  visible,
  onClose,
  title = 'Missing information',
}: {
  message: string;
  visible: boolean;
  onClose: () => void;
  title?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View accessibilityRole="alert" style={styles.card}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name="alert-outline" size={18} color="#D66B4E" />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{message}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>OK</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(7, 24, 50, 0.48)', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 340, borderRadius: 20, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, alignItems: 'center', shadowColor: '#071D49', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFF1EC', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  title: { color: '#172033', fontSize: 18, lineHeight: 22, fontWeight: '900', textAlign: 'center' },
  body: { color: '#667085', fontSize: 13, lineHeight: 18, fontWeight: '600', textAlign: 'center', marginTop: 7, paddingHorizontal: 4 },
  button: { width: '100%', minHeight: 46, borderRadius: 13, backgroundColor: '#07327B', alignItems: 'center', justifyContent: 'center', marginTop: 17 },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
