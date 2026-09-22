import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { Field, PrimaryButton, ScrollScreen, SecondaryButton } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { OwnerStackParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import { pickImage } from '../services/images';
import type { OwnerBusiness } from '../types/business';

type Props = NativeStackScreenProps<OwnerStackParamList, 'ServiceForm'>;

export function ServiceFormScreen({ navigation, route }: Props) {
  const { request, upload } = useAuth();
  const { businessId, serviceId } = route.params;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    request<{ business: OwnerBusiness }>(`/api/businesses/mine/${businessId}`)
      .then((body) => {
        const service = body.business.services.find((item) => item.id === serviceId);
        if (!service || cancelled) return;
        setName(service.name);
        setDescription(service.description);
        setPrice(service.price);
        setDurationMinutes(String(service.durationMinutes));
        setIsActive(service.isActive);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load this service.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, request, serviceId]);

  async function submit() {
    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration)) {
      setError('Duration must be a whole number of minutes.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const body = { name, description, price, durationMinutes: duration, isActive };
    try {
      if (serviceId) {
        await request(`/api/businesses/${businessId}/services/${serviceId}`, {
          method: 'PATCH',
          body,
        });
      } else {
        await request(`/api/businesses/${businessId}/services`, { method: 'POST', body });
      }
      navigation.goBack();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save this service.');
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadServiceImage() {
    if (!serviceId) return;
    try {
      const form = await pickImage();
      if (!form) return;
      await upload(`/api/businesses/${businessId}/services/${serviceId}/image`, form);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload the image.');
    }
  }

  function remove() {
    if (!serviceId) return;
    Alert.alert('Delete this service?', 'Booked services should be deactivated instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void request(`/api/businesses/${businessId}/services/${serviceId}`, { method: 'DELETE' })
            .then(() => navigation.goBack())
            .catch((caught: unknown) => {
              setError(caught instanceof ApiError ? caught.message : 'Unable to delete this service.');
            });
        },
      },
    ]);
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
      <Field keyboardType="decimal-pad" label="Price (N$)" onChangeText={setPrice} value={price} />
      <Field
        keyboardType="number-pad"
        label="Duration in minutes"
        onChangeText={setDurationMinutes}
        value={durationMinutes}
      />
      <View style={styles.row}>
        <Text style={styles.label}>{isActive ? 'Active' : 'Inactive'}</Text>
        <Switch accessibilityLabel="Service is active" onValueChange={setIsActive} value={isActive} />
      </View>
      {serviceId ? (
        <SecondaryButton label="Upload service image" onPress={() => void uploadServiceImage()} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        disabled={submitting}
        label={submitting ? 'Saving…' : 'Save service'}
        onPress={() => void submit()}
      />
      {serviceId ? <SecondaryButton label="Delete service" onPress={remove} /> : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    color: '#1c1915',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#7f1d1d',
    marginBottom: 8,
  },
});
