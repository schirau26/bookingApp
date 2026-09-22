import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ListCard, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { bookingStatusLabels, type BookingRecord } from '../types/booking';
import { formatDuration, formatMoney } from '../types/business';
import { formatWhen } from '../utils/schedule';

export function MyBookingsScreen() {
  const { request } = useAuth();
  const [when, setWhen] = useState<'upcoming' | 'past'>('upcoming');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {bookings.length === 0 ? <Text style={styles.empty}>No {when} bookings.</Text> : null}
      {bookings.map((booking) => (
        <View key={booking.id}>
          <ListCard
            lines={[
              booking.service.name,
              formatWhen(booking.startsAt),
              `${formatMoney(booking.price)} · ${formatDuration(booking.durationMinutes)}`,
              bookingStatusLabels[booking.status],
            ]}
            title={booking.business.name}
          />
          {booking.status === 'PENDING' || booking.status === 'CONFIRMED' ? (
            <Pressable accessibilityRole="button" onPress={() => cancel(booking)} style={styles.cancel}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  chips: {
    flexDirection: 'row',
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
  empty: {
    color: '#3f3832',
    fontSize: 16,
  },
  error: {
    color: '#7f1d1d',
    marginBottom: 12,
  },
  cancel: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    marginTop: -4,
  },
  cancelLabel: {
    color: '#7f1d1d',
    fontSize: 15,
    fontWeight: '600',
  },
});
