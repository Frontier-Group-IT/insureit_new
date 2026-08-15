import { StyleSheet, Text, View } from 'react-native';

export default function IndexScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>InsureIT</Text>
      <Text style={styles.message}>Safe startup diagnostic loaded.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    backgroundColor: '#F4F8FC',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#071D49',
    fontSize: 28,
    fontWeight: '900',
  },
  message: {
    color: '#50627A',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
});
