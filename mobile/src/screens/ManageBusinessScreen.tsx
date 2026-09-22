import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ListCard, PrimaryButton, ScrollScreen, SecondaryButton } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { OwnerStackParamList } from '../navigation/types';
import { ApiError, mediaUrl } from '../services/api';
import { pickImage } from '../services/images';
import {
  WEEKDAYS,
  approvalLabels,
  formatDuration,
  formatMoney,
  type OwnerBusiness,
  type Weekday,
} from '../types/business';

type Props = NativeStackScreenProps<OwnerStackParamList, 'ManageBusiness'>;

type HourDraft = {
  dayOfWeek: Weekday;
  isClosed: boolean;
  openTime: string;
  closeTime: string;
};

function hourDrafts(business: OwnerBusiness | null): HourDraft[] {
  return WEEKDAYS.map((day) => {
    const existing = business?.workingHours.find((hour) => hour.dayOfWeek === day.value);
    if (existing) {
      return {
        dayOfWeek: day.value,
        isClosed: existing.isClosed,
        openTime: existing.openTime ?? '09:00',
        closeTime: existing.closeTime ?? '17:00',
      };
    }
    const weekend = day.value === 'SATURDAY' || day.value === 'SUNDAY';
    return {
      dayOfWeek: day.value,
      isClosed: weekend,
      openTime: '09:00',
      closeTime: weekend ? '13:00' : '17:00',
    };
  });
}

export function ManageBusinessScreen({ navigation, route }: Props) {
  const { request, upload } = useAuth();
  const businessId = route.params.businessId;
  const [business, setBusiness] = useState<OwnerBusiness | null>(null);
  const [hours, setHours] = useState<HourDraft[]>(() => hourDrafts(null));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    request<{ business: OwnerBusiness }>(`/api/businesses/mine/${businessId}`)
      .then((body) => {
        if (cancelled) return;
        setBusiness(body.business);
        setHours(hourDrafts(body.business));
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

  useFocusEffect(load);

  async function uploadImage(path: string) {
    setError(null);
    try {
      const form = await pickImage();
      if (!form) return;
      setBusy(true);
      await upload(path, form);
      load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload the image.');
    } finally {
      setBusy(false);
    }
  }

  async function saveHours() {
    for (const day of hours) {
      if (!day.isClosed && (!/^\d{2}:\d{2}$/.test(day.openTime) || !/^\d{2}:\d{2}$/.test(day.closeTime))) {
        setError('Use HH:mm for open days.');
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await request(`/api/businesses/${businessId}/hours`, {
        method: 'PUT',
        body: {
          hours: hours.map((day) => ({
            dayOfWeek: day.dayOfWeek,
            isClosed: day.isClosed,
            openTime: day.isClosed ? null : day.openTime,
            closeTime: day.isClosed ? null : day.closeTime,
          })),
        },
      });
      load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save hours.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(title: string, action: () => Promise<void>) {
    Alert.alert(title, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void action().catch((caught: unknown) => {
            setError(caught instanceof ApiError ? caught.message : 'Unable to delete that.');
          });
        },
      },
    ]);
  }

  if (!business) {
    return (
      <ScrollScreen>
        {error ? <Text style={styles.error}>{error}</Text> : <Text>Loading…</Text>}
      </ScrollScreen>
    );
  }

  const logo = mediaUrl(business.logoUrl);

  return (
    <ScrollScreen>
      <Text style={styles.status}>{approvalLabels[business.approvalStatus]}</Text>
      {business.rejectionReason ? <Text style={styles.error}>{business.rejectionReason}</Text> : null}
      <Text style={styles.title}>{business.name}</Text>
      <SecondaryButton
        label="Edit details"
        onPress={() => navigation.navigate('BusinessForm', { businessId })}
      />
      <SecondaryButton
        label="View bookings"
        onPress={() => navigation.navigate('OwnerBookings', { businessId })}
      />
      <SecondaryButton
        label="View reviews"
        onPress={() => navigation.navigate('OwnerReviews', { businessId })}
      />
      <Text style={styles.section}>Logo</Text>
      {logo ? <Image source={{ uri: logo }} style={styles.logo} /> : null}
      <PrimaryButton
        disabled={busy}
        label="Upload logo"
        onPress={() => void uploadImage(`/api/businesses/${businessId}/logo`)}
      />
      <Text style={styles.section}>Photos</Text>
      <View style={styles.photos}>
        {business.photos.map((photo) => (
          <Pressable
            accessibilityRole="button"
            key={photo.id}
            onPress={() =>
              confirmDelete('Delete this photo?', async () => {
                await request(`/api/businesses/${businessId}/photos/${photo.id}`, { method: 'DELETE' });
                load();
              })
            }
          >
            <Image source={{ uri: mediaUrl(photo.url) ?? '' }} style={styles.photo} />
          </Pressable>
        ))}
      </View>
      <PrimaryButton
        disabled={busy}
        label="Add photo"
        onPress={() => void uploadImage(`/api/businesses/${businessId}/photos`)}
      />
      <Text style={styles.section}>Services</Text>
      {business.services.map((service) => (
        <ListCard
          key={service.id}
          lines={[
            `${formatMoney(service.price)} · ${formatDuration(service.durationMinutes)}`,
            service.isActive ? 'Active' : 'Inactive',
          ]}
          onPress={() => navigation.navigate('ServiceForm', { businessId, serviceId: service.id })}
          title={service.name}
        />
      ))}
      <PrimaryButton
        label="Add service"
        onPress={() => navigation.navigate('ServiceForm', { businessId })}
      />
      <Text style={styles.section}>Hours</Text>
      {hours.map((day, index) => {
        const label = WEEKDAYS.find((item) => item.value === day.dayOfWeek)?.label ?? day.dayOfWeek;
        return (
          <View key={day.dayOfWeek} style={styles.day}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{label}</Text>
              <Text style={styles.closedLabel}>{day.isClosed ? 'Closed' : 'Open'}</Text>
              <Switch
                accessibilityLabel={`${label} open`}
                onValueChange={(open) =>
                  setHours((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, isClosed: !open } : item,
                    ),
                  )
                }
                value={!day.isClosed}
              />
            </View>
            {day.isClosed ? null : (
              <View style={styles.times}>
                <TextInput
                  accessibilityLabel={`${label} opens`}
                  onChangeText={(openTime) =>
                    setHours((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, openTime } : item,
                      ),
                    )
                  }
                  style={styles.time}
                  value={day.openTime}
                />
                <TextInput
                  accessibilityLabel={`${label} closes`}
                  onChangeText={(closeTime) =>
                    setHours((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, closeTime } : item,
                      ),
                    )
                  }
                  style={styles.time}
                  value={day.closeTime}
                />
              </View>
            )}
          </View>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton disabled={busy} label="Save hours" onPress={() => void saveHours()} />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  status: {
    color: '#6b6256',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1c1915',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  section: {
    color: '#1c1915',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 24,
  },
  logo: {
    borderRadius: 16,
    height: 96,
    marginBottom: 12,
    width: 96,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  photo: {
    borderRadius: 12,
    height: 88,
    width: 88,
  },
  day: {
    marginBottom: 12,
  },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  dayLabel: {
    color: '#1c1915',
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  closedLabel: {
    color: '#6b6256',
  },
  times: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  time: {
    backgroundColor: '#fff',
    borderColor: '#e4ddd2',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  error: {
    color: '#7f1d1d',
    marginBottom: 8,
  },
});
