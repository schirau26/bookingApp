import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, PrimaryButton, Screen, SecondaryButton } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { validateRegister } from '../utils/validation';
import type { RootStackParamList } from '../navigation/RootNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Register'>;
type AccountRole = 'CUSTOMER' | 'BUSINESS_OWNER';

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AccountRole>('CUSTOMER');
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
        role,
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
      <Text style={styles.label}>Account type</Text>
      <View style={styles.roles}>
        <RoleOption
          label="Customer"
          selected={role === 'CUSTOMER'}
          onPress={() => setRole('CUSTOMER')}
        />
        <RoleOption
          label="Business owner"
          selected={role === 'BUSINESS_OWNER'}
          onPress={() => setRole('BUSINESS_OWNER')}
        />
      </View>
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

function RoleOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.role, selected ? styles.roleSelected : null]}
    >
      <Text style={styles.roleLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#1c1915',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 24,
  },
  label: {
    color: '#3f3832',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  roles: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  role: {
    borderColor: '#e4ddd2',
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  roleSelected: {
    borderColor: '#1c1915',
  },
  roleLabel: {
    color: '#1c1915',
    fontWeight: '600',
  },
  error: {
    color: '#7f1d1d',
    marginBottom: 8,
  },
});
