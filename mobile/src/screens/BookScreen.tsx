import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, PrimaryButton, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { CustomerStackParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import type { BookingRecord } from '../types/booking';
import { formatDuration, formatMoney, type PublicService } from '../types/business';
import { addDays, formatDateLabel, formatTime, windhoekDate } from '../utils/schedule';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Book'>;

type Slot = { startsAt: string; endsAt: string };

export function BookScreen({ navigation, route }: Props) {
  const { request, user } = useAuth();
  const { businessId, serviceId } = route.params;
  const dates = useMemo(() => {
    const today = windhoekDate();
    return Array.from({ length: 14 }, (_, index) => addDays(today, index));
  }, []);
  const [date, setDate] = useState(dates[0]);
  const [service, setService] = useState<PublicService | null>(null);
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
    request<{ services: PublicService[] }>(`/api/businesses/${businessId}/services`)
      .then((body) => {
        if (!cancelled) {
          setService(body.services.find((item) => item.id === serviceId) ?? null);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessId, request, serviceId]);

  useEffect(() => {
    let cancelled = false;
    request<{ slots: Slot[] }>(
      `/api/businesses/${businessId}/services/${serviceId}/availability?date=${date}`,
    )
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
  }, [businessId, date, request, serviceId]);

  async function submit() {
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
          businessId,
          serviceId,
          startsAt,
          customerName,
          customerPhone,
          customerEmail,
          note,
        },
      });
      navigation.replace('MyBookings');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to create this booking.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollScreen>
      <Text style={styles.title}>{service?.name ?? 'Book a time'}</Text>
      {service ? (
        <Text style={styles.meta}>
          {formatMoney(service.price)} · {formatDuration(service.durationMinutes)}
        </Text>
      ) : null}
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
                {formatDateLabel(value)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.label}>Time</Text>
      {loading ? <ActivityIndicator /> : null}
      {!loading && slots.length === 0 ? <Text style={styles.meta}>No times are open on this day.</Text> : null}
      <View style={styles.chips}>
        {slots.map((slot) => {
          const active = slot.startsAt === startsAt;
          return (
            <Pressable
              accessibilityRole="button"
              key={slot.startsAt}
              onPress={() => setStartsAt(slot.startsAt)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
                {formatTime(slot.startsAt)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Field autoCapitalize="words" label="Name" onChangeText={setCustomerName} value={customerName} />
      <Field keyboardType="phone-pad" label="Phone" onChangeText={setCustomerPhone} value={customerPhone} />
      <Field
        autoComplete="email"
        keyboardType="email-address"
        label="Email"
        onChangeText={setCustomerEmail}
        value={customerEmail}
      />
      <Field label="Note" multiline onChangeText={setNote} value={note} />
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
    color: '#1c1915',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  meta: {
    color: '#3f3832',
    fontSize: 16,
    marginBottom: 12,
  },
  label: {
    color: '#3f3832',
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
    borderColor: '#e4ddd2',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#1c1915',
    borderColor: '#1c1915',
  },
  chipLabel: {
    color: '#1c1915',
    fontSize: 14,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: '#fff',
  },
  error: {
    color: '#7f1d1d',
    marginBottom: 8,
  },
});
