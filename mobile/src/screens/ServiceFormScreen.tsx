import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Field, PrimaryButton, ScrollScreen, SecondaryButton } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { OwnerRootParamList } from '../navigation/types';
import { ApiError, mediaUrl } from '../services/api';
import { colors } from '../theme/colors';
import { pickImage } from '../services/images';
import {
  DEFAULT_SERVICE_ICON,
  SERVICE_ICONS,
  VEHICLE_SIZE_OPTIONS,
  type OwnerBusiness,
  type ServiceIcon,
  type VehicleSize,
} from '../types/business';

type Props = NativeStackScreenProps<OwnerRootParamList, 'ServiceForm'>;

export function ServiceFormScreen({ navigation, route }: Props) {
  const { request, upload } = useAuth();
  const { businessId, serviceId } = route.params;
  const [savedId, setSavedId] = useState(serviceId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prices, setPrices] = useState(() =>
    VEHICLE_SIZE_OPTIONS.map((option) => ({
      vehicleSize: option.value,
      price: '',
      durationMinutes: '30',
    })),
  );
  const [isActive, setIsActive] = useState(true);
  const [icon, setIcon] = useState<ServiceIcon>(DEFAULT_SERVICE_ICON);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    request<{ business: OwnerBusiness }>(`/api/businesses/mine/${businessId}`)
      .then((body) => {
        const service = body.business.packages.find((item) => item.id === serviceId);
        if (!service || cancelled) return;
        setName(service.name);
        setDescription(service.description);
        setPrices(
          VEHICLE_SIZE_OPTIONS.map((option) => {
            const row = service.prices.find((price) => price.vehicleSize === option.value);
            return {
              vehicleSize: option.value,
              price: row?.price ?? '',
              durationMinutes: String(row?.durationMinutes ?? 30),
            };
          }),
        );
        setIsActive(service.isActive ?? true);
        setIcon(
          SERVICE_ICONS.includes(service.icon as ServiceIcon)
            ? (service.icon as ServiceIcon)
            : DEFAULT_SERVICE_ICON,
        );
        setImageUrl(service.imageUrl);
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

  function updatePrice(size: VehicleSize, field: 'price' | 'durationMinutes', value: string) {
    setPrices((current) =>
      current.map((row) => (row.vehicleSize === size ? { ...row, [field]: value } : row)),
    );
  }

  async function submit() {
    if (prices.some((row) => !Number.isInteger(Number(row.durationMinutes)) || !row.price.trim())) {
      setError('Enter a price and a whole number of minutes for every vehicle size.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const body = {
      name,
      description,
      isActive,
      icon,
      prices: prices.map((row) => ({
        vehicleSize: row.vehicleSize,
        price: row.price,
        durationMinutes: Number(row.durationMinutes),
      })),
    };
    try {
      if (savedId) {
        await request(`/api/businesses/${businessId}/services/${savedId}`, {
          method: 'PATCH',
          body,
        });
        navigation.goBack();
      } else {
        const created = await request<{ service: { id: string } }>(
          `/api/businesses/${businessId}/services`,
          { method: 'POST', body },
        );
        setSavedId(created.service.id);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save this service.');
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadServiceImage() {
    if (!savedId) return;
    try {
      const form = await pickImage();
      if (!form) return;
      const saved = await upload<{ imageUrl: string }>(
        `/api/businesses/${businessId}/services/${savedId}/image`,
        form,
      );
      setImageUrl(saved.imageUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload the image.');
    }
  }

  function remove() {
    if (!savedId) return;
    Alert.alert('Delete this package?', 'Booked packages should be deactivated instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void request(`/api/businesses/${businessId}/services/${savedId}`, { method: 'DELETE' })
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
      <Text style={styles.label}>Price and time by vehicle size</Text>
      {prices.map((row) => {
        const label = VEHICLE_SIZE_OPTIONS.find((option) => option.value === row.vehicleSize)?.label;
        return (
          <View key={row.vehicleSize}>
            <Field
              keyboardType="decimal-pad"
              label={`${label} price (N$)`}
              onChangeText={(value) => updatePrice(row.vehicleSize, 'price', value)}
              value={row.price}
            />
            <Field
              keyboardType="number-pad"
              label={`${label} minutes`}
              onChangeText={(value) => updatePrice(row.vehicleSize, 'durationMinutes', value)}
              value={row.durationMinutes}
            />
          </View>
        );
      })}
      <Text style={styles.label}>Icon</Text>
      <View style={styles.icons}>
        {SERVICE_ICONS.map((name) => {
          const selected = name === icon;
          return (
            <Pressable
              accessibilityLabel={name}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={name}
              onPress={() => setIcon(name)}
              style={[styles.iconButton, selected ? styles.iconButtonActive : null]}
            >
              <Ionicons color={colors.ink} name={name} size={22} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>{isActive ? 'Active' : 'Inactive'}</Text>
        <Switch
          accessibilityLabel="Service is active"
          onValueChange={setIsActive}
          trackColor={{ false: colors.line, true: colors.lime }}
          value={isActive}
        />
      </View>
      {savedId ? (
        <>
          {imageUrl ? (
            <Image source={{ uri: mediaUrl(imageUrl) ?? '' }} style={styles.preview} />
          ) : null}
          <SecondaryButton label="Upload service image" onPress={() => void uploadServiceImage()} />
        </>
      ) : (
        <Text style={styles.hint}>Save the service first, then you can add a photo.</Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        disabled={submitting}
        label={submitting ? 'Saving…' : 'Save package'}
        onPress={() => void submit()}
      />
      {savedId ? <SecondaryButton label="Delete package" onPress={remove} /> : null}
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
    color: colors.ink,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  icons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  iconButtonActive: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  preview: {
    borderRadius: 16,
    height: 96,
    marginBottom: 8,
    width: 96,
  },
  hint: {
    color: colors.muted,
    fontSize: 14,
    marginBottom: 8,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
});
