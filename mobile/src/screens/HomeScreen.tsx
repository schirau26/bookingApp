import { StyleSheet, Text } from 'react-native';
import { PrimaryButton, Screen } from '../components/Form';
import { useAuth } from '../context/AuthContext';

const roleLabels = {
  CUSTOMER: 'Customer',
  BUSINESS_OWNER: 'Business owner',
  ADMIN: 'Administrator',
} as const;

export function HomeScreen() {
  const { user, logout } = useAuth();

  return (
    <Screen>
      <Text style={styles.eyebrow}>Signed in</Text>
      <Text style={styles.title}>{user?.fullName}</Text>
      <Text style={styles.body}>{user?.email}</Text>
      <Text style={styles.body}>{user ? roleLabels[user.role] : ''}</Text>
      <PrimaryButton
        label="Log out"
        onPress={() => {
          void logout();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 12,
  },
  body: {
    color: '#3f3832',
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 8,
  },
});
