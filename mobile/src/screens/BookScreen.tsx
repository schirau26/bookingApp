import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, PrimaryButton, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { CustomerRootParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import type { BookingRecord, VehicleSize } from '../types/booking';
import {
  VEHICLE_SIZE_OPTIONS,
  formatDuration,
  formatMoney,
  priceFor,
  type Wash,
  type WashPackage,
} from '../types/business';
import { addDays, formatDateLabel, formatTime, windhoekDate } from '../utils/schedule';

type Props = NativeStackScreenProps<CustomerRootParamList, 'Book'>;
type Slot = { startsAt: string; endsAt: string };
type IconName = ComponentProps<typeof Ionicons>['name'];

function dateLabel(value: string, today: string) {
  if (value === today) return 'Today';
  if (value === addDays(today, 1)) return 'Tomorrow';
  return formatDateLabel(value);
}

export function BookScreen({ navigation, route }: Props) {
  const { request, user } = useAuth();
  const dates = useMemo(() => {
    const today = windhoekDate();
    return Array.from({ length: 14 }, (_, index) => addDays(today, index));
  }, []);
  const [date, setDate] = useState(dates[0]);
  const [packages, setPackages] = useState<WashPackage[]>([]);
  const [packagesReady, setPackagesReady] = useState(false);
  const [packageId, setPackageId] = useState<string | null>(route.params.packageId ?? null);
  const [vehicleSize, setVehicleSize] = useState<VehicleSize>('SEDAN');
  const [registration, setRegistration] = useState('');
  const [make, setMake] = useState('');
  const [color, setColor] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState(user?.fullName ?? '');
  const [customerPhone, setCustomerPhone] = useState(user?.phone ?? '');
  const [customerEmail, setCustomerEmail] = useState(user?.email ?? '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    request<{ wash: Wash }>('/api/wash')
      .then((body) => {
        if (cancelled) return;
        setPackages(body.wash.packages);
        setPackageId((current) => {
          if (current && body.wash.packages.some((item) => item.id === current)) return current;
          return body.wash.packages[0]?.id ?? null;
        });
        if (body.wash.packages.length === 0) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      })
      .finally(() => {
        if (!cancelled) setPackagesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  useEffect(() => {
    if (!packageId) return;
    let cancelled = false;
    const params = new URLSearchParams({ packageId, vehicleSize, date });
    request<{ slots: Slot[] }>(`/api/wash/availability?${params.toString()}`)
      .then((body) => {
        if (cancelled) return;
        setSlots(body.slots);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setSlots([]);
          setError(caught instanceof ApiError ? caught.message : 'Unable to load available times.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, packageId, request, vehicleSize]);

  async function submit() {
    if (!packageId) {
      setError('Choose a package.');
      return;
    }
    if (!registration.trim()) {
      setError('Enter the registration.');
      return;
    }
    if (!startsAt) {
      setError('Choose a time.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await request<{ booking: BookingRecord }>('/api/bookings', {
        method: 'POST',
        body: {
          packageId,
          vehicleSize,
          registration: registration.trim(),
          make: make.trim(),
          color: color.trim(),
          startsAt,
          customerName,
          customerPhone,
          customerEmail,
          note,
        },
      });
      navigation.navigate('CustomerTabs', {
        screen: 'BookingsTab',
        params: { screen: 'MyBookings' },
      });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create this booking.');
    } finally {
      setSubmitting(false);
    }
  }

  const selected = packages.find((item) => item.id === packageId) ?? null;
  const selectedPrice = selected ? priceFor(selected, vehicleSize) : null;

  const sizeLabel = VEHICLE_SIZE_OPTIONS.find((option) => option.value === vehicleSize)?.label ?? vehicleSize;

  return (
    <ScrollScreen>
      {selected && selectedPrice ? (
        <View style={styles.summary}>
          <View style={styles.summaryIcon}>
            <Ionicons color={colors.ink} name={selected.icon as IconName} size={22} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryName}>{selected.name}</Text>
            <Text style={styles.meta}>{formatDuration(selectedPrice.durationMinutes)}</Text>
            <Text style={styles.summaryPrice}>
              {formatMoney(selectedPrice.price)} for {sizeLabel}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.title}>Book a wash</Text>
      )}
      <Text style={styles.label}>Package</Text>
      {packagesReady && packages.length === 0 ? (
        <Text style={styles.meta}>No packages are available to book.</Text>
      ) : null}
      <View style={styles.chips}>
        {packages.map((item) => {
          const active = item.id === packageId;
          return (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => {
                if (item.id === packageId) return;
                setLoading(true);
                setStartsAt(null);
                setPackageId(item.id);
              }}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>{item.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>Vehicle size</Text>
      <View style={styles.chips}>
        {VEHICLE_SIZE_OPTIONS.map((option) => {
          const active = option.value === vehicleSize;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => {
                if (option.value === vehicleSize) return;
                setLoading(true);
                setStartsAt(null);
                setVehicleSize(option.value);
              }}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field
        autoCapitalize="characters"
        icon="card-outline"
        label="Registration"
        onChangeText={setRegistration}
        value={registration}
      />
      <Field autoCapitalize="words" icon="car-outline" label="Make (optional)" onChangeText={setMake} value={make} />
      <Field
        autoCapitalize="words"
        icon="color-palette-outline"
        label="Colour (optional)"
        onChangeText={setColor}
        value={color}
      />
      <Text style={styles.label}>Date</Text>
      <View style={styles.chips}>
        {dates.map((value) => {
          const active = value === date;
          return (
            <Pressable
              accessibilityRole="button"
              key={value}
              onPress={() => {
                setLoading(true);
                setStartsAt(null);
                setDate(value);
              }}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
                {dateLabel(value, dates[0])}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>Time</Text>
      {loading ? <ActivityIndicator color={colors.blue} /> : null}
      {!loading && slots.length === 0 ? <Text style={styles.meta}>No times are open on this day.</Text> : null}
      <View style={styles.chips}>
        {slots.map((slot) => {
          const active = slot.startsAt === startsAt;
          return (
            <Pressable
              accessibilityRole="button"
              key={slot.startsAt}
              onPress={() => setStartsAt(slot.startsAt)}
              style={[styles.chip, active ? styles.chipTime : null]}
            >
              <Text style={[styles.chipLabel, active ? styles.chipLabelTime : null]}>
                {formatTime(slot.startsAt)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Field autoCapitalize="words" icon="person-outline" label="Name" onChangeText={setCustomerName} value={customerName} />
      <Field
        icon="call-outline"
        keyboardType="phone-pad"
        label="Phone"
        onChangeText={setCustomerPhone}
        value={customerPhone}
      />
      <Field
        autoComplete="email"
        icon="mail-outline"
        keyboardType="email-address"
        label="Email"
        onChangeText={setCustomerEmail}
        value={customerEmail}
      />
      <Field
        icon="pencil-outline"
        label="Note"
        multiline
        onChangeText={setNote}
        placeholder="Add any special requests or notes..."
        value={note}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        disabled={submitting}
        label={submitting ? 'Booking…' : 'Confirm booking'}
        onPress={() => void submit()}
      />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  summary: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    padding: 14,
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.blueSoft,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  summaryPrice: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  meta: {
    color: colors.inkSoft,
    fontSize: 14,
    marginTop: 2,
  },
  label: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: colors.blue,
  },
  chipLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: colors.white,
  },
  chipTime: {
    backgroundColor: colors.lime,
  },
  chipLabelTime: {
    color: colors.ink,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
});
