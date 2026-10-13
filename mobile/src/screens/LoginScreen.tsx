import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Field, PrimaryButton, Screen, SecondaryButton } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { validateLogin } from '../utils/validation';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const validationError = validateLogin(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Sign in</Text>
      <Field
        label="Email"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Password"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={submitting ? 'Signing in…' : 'Sign in'}
        disabled={submitting}
        onPress={() => {
          void submit();
        }}
      />
      <SecondaryButton label="Create an account" onPress={() => navigation.navigate('Register')} />
      <View style={styles.logo}>
        <Ionicons color={colors.ink} name="car-sport-outline" size={44} />
        <View style={styles.swoosh} />
        <Text style={styles.wordmark}>Urban Glow</Text>
        <Text style={styles.wordmarkSub}>Car Wash</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
  logo: {
    alignItems: 'center',
    marginTop: 36,
  },
  swoosh: {
    backgroundColor: colors.lime,
    borderRadius: 4,
    height: 4,
    marginTop: -4,
    width: 72,
  },
  wordmark: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 10,
  },
  wordmarkSub: {
    color: colors.goldInk,
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
});
