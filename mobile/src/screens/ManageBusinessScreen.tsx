import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState, type ComponentProps } from 'react';
import { Alert, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Field, ListCard, PrimaryButton, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { OwnerManageStackParamList, OwnerRootParamList } from '../navigation/types';
import { ApiError, mediaUrl } from '../services/api';
import { colors } from '../theme/colors';
import { pickImage } from '../services/images';
import {
  WEEKDAYS,
  formatMoney,
  type OwnerBusiness,
  type Weekday,
} from '../types/business';

type Props = CompositeScreenProps<
  NativeStackScreenProps<OwnerManageStackParamList, 'ManageBusiness'>,
  NativeStackScreenProps<OwnerRootParamList>
>;
type IconName = ComponentProps<typeof Ionicons>['name'];

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

export function ManageBusinessScreen({ navigation }: Props) {
  const { request, upload } = useAuth();
  const [business, setBusiness] = useState<OwnerBusiness | null>(null);
  const [hours, setHours] = useState<HourDraft[]>(() => hourDrafts(null));
  const [bayCount, setBayCount] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    request<{ businesses: OwnerBusiness[] }>('/api/businesses/mine')
      .then((body) => {
        if (cancelled) return;
        const wash = body.businesses[0];
        if (!wash) {
          setError('Wash not found');
          return;
        }
        setBusiness(wash);
        setBayCount(String(wash.bayCount));
        setHours(hourDrafts(wash));
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load this business.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

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
    if (!business) return;
    setBusy(true);
    setError(null);
    try {
      await request(`/api/businesses/${business.id}/hours`, {
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

  async function saveBays() {
    if (!business) return;
    const count = Number(bayCount);
    if (!Number.isInteger(count) || count < 1 || count > 20) {
      setError('Bay count must be a whole number from 1 to 20.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await request(`/api/businesses/${business.id}`, { method: 'PATCH', body: { bayCount: count } });
      load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save the bay count.');
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
      <Text style={styles.title}>{business.name}</Text>
      <View style={styles.actions}>
        <ActionTile
          icon="star-outline"
          label="Reviews"
          onPress={() => navigation.navigate('OwnerReviews', { businessId: business.id })}
        />
      </View>
      <Text style={styles.section}>Bays</Text>
      <Field keyboardType="number-pad" label="Cars washed at once" onChangeText={setBayCount} value={bayCount} />
      <PrimaryButton disabled={busy} label="Save bays" onPress={() => void saveBays()} />
      <Text style={styles.section}>Logo</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={logo ? 'Change logo' : 'Upload logo'}
        disabled={busy}
        onPress={() => void uploadImage(`/api/businesses/${business.id}/logo`)}
        style={styles.logoCard}
      >
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logoImage} />
        ) : (
          <View style={styles.logoEmpty}>
            <Ionicons color={colors.lime} name="image-outline" size={28} />
            <Text style={styles.logoEmptyText}>Add a logo</Text>
          </View>
        )}
        <View style={styles.logoBadge}>
          <Ionicons color={colors.ink} name="camera" size={14} />
          <Text style={styles.logoBadgeText}>{busy ? 'Please wait' : logo ? 'Change' : 'Upload'}</Text>
        </View>
      </Pressable>
      <Text style={styles.section}>Photos</Text>
      <View style={styles.photos}>
        {business.photos.map((photo) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete this photo"
            key={photo.id}
            onPress={() =>
              confirmDelete('Delete this photo?', async () => {
                await request(`/api/businesses/${business.id}/photos/${photo.id}`, { method: 'DELETE' });
                load();
              })
            }
            style={styles.photoWrap}
          >
            <Image source={{ uri: mediaUrl(photo.url) ?? '' }} style={styles.photo} />
            <View style={styles.photoRemove}>
              <Ionicons color={colors.white} name="close" size={14} />
            </View>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photo"
          disabled={busy}
          onPress={() => void uploadImage(`/api/businesses/${business.id}/photos`)}
          style={styles.addPhoto}
        >
          <Ionicons color={colors.ink} name="add" size={28} />
          <Text style={styles.addPhotoText}>Add</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>Tap a photo to remove it.</Text>
      <Text style={styles.section}>Packages</Text>
      {business.packages.map((service) => (
        <ListCard
          icon={service.icon as IconName}
          key={service.id}
          lines={[
            service.startingPrice ? `From ${formatMoney(service.startingPrice)}` : 'Set prices',
            service.isActive ? 'Active' : 'Inactive',
          ]}
          onPress={() => navigation.navigate('ServiceForm', { businessId: business.id, serviceId: service.id })}
          title={service.name}
        />
      ))}
      <PrimaryButton
        label="Add package"
        onPress={() => navigation.navigate('ServiceForm', { businessId: business.id })}
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
                trackColor={{ false: colors.line, true: colors.lime }}
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

function ActionTile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.tile}>
      <View style={styles.tileIcon}>
        <Ionicons color={colors.ink} name={icon} size={20} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  tile: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    flex: 1,
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  tileIcon: {
    alignItems: 'center',
    backgroundColor: colors.lime,
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  tileLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  logoCard: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    height: 180,
    overflow: 'hidden',
  },
  logoImage: {
    height: '100%',
    width: '100%',
  },
  logoEmpty: {
    alignItems: 'center',
    gap: 8,
    height: '100%',
    justifyContent: 'center',
  },
  logoEmptyText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  logoBadge: {
    alignItems: 'center',
    backgroundColor: colors.lime,
    borderRadius: 999,
    bottom: 12,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    position: 'absolute',
    right: 12,
  },
  logoBadgeText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  photoWrap: {
    borderRadius: 18,
    height: 108,
    overflow: 'hidden',
    width: 108,
  },
  photoRemove: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: 6,
    top: 6,
    width: 24,
  },
  addPhoto: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    height: 108,
    justifyContent: 'center',
    width: 108,
  },
  addPhotoText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 8,
  },
  status: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  section: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 24,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photo: {
    height: '100%',
    width: '100%',
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
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  closedLabel: {
    color: colors.muted,
  },
  times: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  time: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
});
