import { StyleSheet, Text } from 'react-native';
import { Screen } from '../components/Form';

export function AdminHomeScreen() {
  return (
    <Screen>
      <Text style={styles.title}>Use the web dashboard</Text>
      <Text style={styles.body}>
        The full dashboard for users, businesses, bookings, reviews, and categories is on the admin website.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#1c1915',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#3f3832',
    fontSize: 17,
    lineHeight: 26,
  },
});
