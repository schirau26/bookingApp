import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Booking platform</Text>
      <Text style={styles.title}>Find a service and reserve a time.</Text>
      <Text style={styles.body}>
        This is the mobile app shell for customers and business owners. Sign-in and booking arrive
        in later phases.
      </Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f4ef',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  eyebrow: {
    color: '#6b6256',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1c1915',
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
    marginBottom: 16,
  },
  body: {
    color: '#3f3832',
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 420,
  },
});
