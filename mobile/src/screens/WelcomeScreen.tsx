import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text } from 'react-native';
import { PrimaryButton, Screen, SecondaryButton } from '../components/Form';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  return (
    <Screen>
      <Text style={styles.eyebrow}>Booking platform</Text>
      <Text style={styles.title}>Find a service and reserve a time.</Text>
      <Text style={styles.body}>
        Sign in as a customer or a business owner. Booking tools arrive in a later phase.
      </Text>
      <PrimaryButton label="Sign in" onPress={() => navigation.navigate('Login')} />
      <SecondaryButton label="Create an account" onPress={() => navigation.navigate('Register')} />
      <StatusBar style="dark" />
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
    lineHeight: 40,
    marginBottom: 16,
  },
  body: {
    color: '#3f3832',
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 24,
    maxWidth: 420,
  },
});
