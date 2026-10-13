import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const roleLabels = {
  CUSTOMER: 'Customer',
  BUSINESS_OWNER: 'Wash owner',
};

export function ProfileScreen() {
  const { logout, user } = useAuth();
  const initial = user?.fullName.trim().charAt(0).toUpperCase() ?? '?';

  return (
    <ScrollScreen>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>{initial}</Text>
        </View>
        <Text style={styles.name}>{user?.fullName}</Text>
        <Text style={styles.role}>{user ? roleLabels[user.role] : ''}</Text>
        <Text style={styles.line}>{user?.email}</Text>
        {user?.phone ? <Text style={styles.line}>{user.phone}</Text> : null}
      </View>
      <PrimaryButton label="Log out" onPress={() => void logout()} />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    marginBottom: 8,
    padding: 24,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.lime,
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    marginBottom: 16,
    width: 80,
  },
  initial: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
  },
  name: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  role: {
    color: colors.goldInk,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 4,
  },
  line: {
    color: colors.muted,
    fontSize: 16,
    marginTop: 4,
    textAlign: 'center',
  },
});
