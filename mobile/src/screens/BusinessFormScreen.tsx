import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Field, PrimaryButton, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { OwnerStackParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import type { Category, OwnerBusiness } from '../types/business';

type Props = NativeStackScreenProps<OwnerStackParamList, 'BusinessForm'>;

export function BusinessFormScreen({ navigation, route }: Props) {
  const { request } = useAuth();
  const businessId = route.params?.businessId;
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    request<{ categories: Category[] }>('/api/categories')
      .then((body) => {
        if (!cancelled) setCategories(body.categories);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load categories.');
        }
      });

    if (!businessId) return () => {
      cancelled = true;
    };

    request<{ business: OwnerBusiness }>(`/api/businesses/mine/${businessId}`)
      .then((body) => {
        if (cancelled) return;
        setName(body.business.name);
        setDescription(body.business.description);
        setAddress(body.business.address);
        setPhone(body.business.phone);
        setEmail(body.business.email);
        setCategoryId(body.business.category.id);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load this business.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [businessId, request]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const body = { name, description, address, phone, email, categoryId };
    try {
      const saved = businessId
        ? await request<{ business: OwnerBusiness }>(`/api/businesses/${businessId}`, {
            method: 'PATCH',
            body,
          })
        : await request<{ business: OwnerBusiness }>('/api/businesses', {
            method: 'POST',
            body,
          });
      navigation.replace('ManageBusiness', { businessId: saved.business.id });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save this business.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollScreen>
      <Field autoCapitalize="words" label="Name" onChangeText={setName} value={name} />
      <Field
        autoCapitalize="sentences"
        label="Description"
        multiline
        onChangeText={setDescription}
        value={description}
      />
      <Field autoCapitalize="words" label="Address" onChangeText={setAddress} value={address} />
      <Field keyboardType="phone-pad" label="Phone" onChangeText={setPhone} value={phone} />
      <Field
        autoComplete="email"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        value={email}
      />
      <Text style={styles.label}>Category</Text>
      {categories.map((category) => {
        const selected = category.id === categoryId;
        return (
          <Pressable
            accessibilityRole="button"
            key={category.id}
            onPress={() => setCategoryId(category.id)}
            style={[styles.choice, selected ? styles.choiceSelected : null]}
          >
            <Text style={styles.choiceLabel}>{category.name}</Text>
          </Pressable>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        disabled={submitting}
        label={submitting ? 'Saving…' : businessId ? 'Save changes' : 'Create business'}
        onPress={() => void submit()}
      />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: '#3f3832',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  choice: {
    backgroundColor: '#fff',
    borderColor: '#e4ddd2',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  choiceSelected: {
    borderColor: '#1c1915',
  },
  choiceLabel: {
    color: '#1c1915',
    fontSize: 16,
  },
  error: {
    color: '#7f1d1d',
    marginBottom: 8,
  },
});
