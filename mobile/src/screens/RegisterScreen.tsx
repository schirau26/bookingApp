import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Field, PrimaryButton, Screen, SecondaryButton } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { validateRegister } from '../utils/validation';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const validationError = validateRegister({ fullName, email, password, phone });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create the account.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Create an account</Text>
      <Field label="Full name" autoCapitalize="words" value={fullName} onChangeText={setFullName} />
      <Field
        label="Email"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Field
        label="Phone (optional)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Field
        label="Password"
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label={submitting ? 'Creating account…' : 'Create account'}
        disabled={submitting}
        onPress={() => {
          void submit();
        }}
      />
      <SecondaryButton
        label="Already have an account?"
        onPress={() => navigation.navigate('Login')}
      />
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
});
