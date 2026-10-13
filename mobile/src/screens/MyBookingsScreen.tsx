import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { BookingsStackParamList, CustomerRootParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import { bookingStatusLabels, vehicleSizeLabels, type BookingRecord } from '../types/booking';
import { formatDuration, formatMoney } from '../types/business';
import { formatWhen } from '../utils/schedule';

type Props = CompositeScreenProps<
  NativeStackScreenProps<BookingsStackParamList, 'MyBookings'>,
  NativeStackScreenProps<CustomerRootParamList>
>;

export function MyBookingsScreen({ navigation }: Props) {
  const { request } = useAuth();
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    request<{ bookings: BookingRecord[] }>(`/api/bookings/mine?when=${when}`)
      .then((body) => {
        if (!cancelled) {
          setBookings(body.bookings);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load your bookings.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request, when]);

  useFocusEffect(load);

  function cancel(booking: BookingRecord) {
    Alert.alert('Cancel this booking?', 'You can book another time afterwards.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: () => {
          void request(`/api/bookings/${booking.id}/cancel`, { method: 'POST' })
            .then(() => load())
            .catch((caught: unknown) => {
              setError(caught instanceof ApiError ? caught.message : 'Unable to cancel this booking.');
            });
        },
      },
    ]);
  }

  return (
    <ScrollScreen>
      <View style={styles.chips}>
        {(['upcoming', 'past'] as const).map((value) => {
          const active = value === when;
          return (
            <Pressable
              accessibilityRole="button"
              key={value}
              onPress={() => setWhen(value)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
                {value === 'upcoming' ? 'Upcoming' : 'Past'}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {loading ? <ActivityIndicator color={colors.blue} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && bookings.length === 0 ? (
        <Text style={styles.empty}>No {when} bookings.</Text>
      ) : null}
      {bookings.map((booking) => (
        <View key={booking.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardCopy}>
              <Text style={styles.cardTitle}>{booking.service.name}</Text>
              <Text style={styles.cardLine}>{formatWhen(booking.startsAt)}</Text>
              <Text style={styles.cardLine}>
                {booking.registration} · {vehicleSizeLabels[booking.vehicleSize]}
              </Text>
              <Text style={styles.cardLine}>
                {formatDuration(booking.durationMinutes)} · {formatMoney(booking.price)}
              </Text>
            </View>
            <View style={[styles.status, statusTone(booking.status)]}>
              <Text style={[styles.statusLabel, statusText(booking.status)]}>
                {bookingStatusLabels[booking.status].toUpperCase()}
              </Text>
            </View>
          </View>
          {booking.status === 'READY' || booking.status === 'COMPLETED' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Invoice', { bookingId: booking.id })}
              style={styles.action}
            >
              <Text style={styles.reviewLabel}>{booking.invoice ? 'View invoice' : 'Invoice'}</Text>
            </Pressable>
          ) : null}
          {booking.status === 'COMPLETED' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                navigation.navigate('ReviewForm', {
                  businessId: booking.business.id,
                  ...(booking.review ? { reviewId: booking.review.id } : { bookingId: booking.id }),
                })
              }
              style={styles.action}
            >
              <Text style={styles.reviewLabel}>{booking.review ? 'Edit review' : 'Write a review'}</Text>
            </Pressable>
          ) : null}
          {booking.status === 'CONFIRMED' ? (
            <Pressable accessibilityRole="button" onPress={() => cancel(booking)} style={styles.action}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollScreen>
  );
}

function statusTone(status: BookingRecord['status']) {
  if (status === 'ARRIVED') return { backgroundColor: '#E7EEF8' };
  if (status === 'WASHING') return { backgroundColor: '#F3E8FF' };
  if (status === 'READY' || status === 'COMPLETED') return { backgroundColor: '#E7F6EC' };
  if (status === 'CANCELLED' || status === 'NO_SHOW') return { backgroundColor: '#FDECEC' };
  return { backgroundColor: '#FFF6D8' };
}

function statusText(status: BookingRecord['status']) {
  if (status === 'ARRIVED') return { color: colors.arrived };
  if (status === 'WASHING') return { color: colors.washing };
  if (status === 'READY' || status === 'COMPLETED') return { color: colors.ready };
  if (status === 'CANCELLED' || status === 'NO_SHOW') return { color: colors.danger };
  return { color: colors.goldInk };
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 16,
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    marginBottom: 12,
    padding: 16,
  },
  cardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  cardCopy: {
    flex: 1,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  status: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  cardLine: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
  },
  action: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  empty: {
    color: colors.muted,
    fontSize: 16,
  },
  spinner: {
    marginVertical: 24,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  cancelLabel: {
    color: colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  reviewLabel: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: '600',
  },
});
