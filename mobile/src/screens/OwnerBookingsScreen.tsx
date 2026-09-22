import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ListCard, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { OwnerStackParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import { bookingStatusLabels, type BookingRecord, type BookingStatus } from '../types/booking';
import { formatWhen } from '../utils/schedule';

type Props = NativeStackScreenProps<OwnerStackParamList, 'OwnerBookings'>;

const filters: { label: string; value: BookingStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'No-show', value: 'NO_SHOW' },
];

export function OwnerBookingsScreen({ route }: Props) {
  const { request } = useAuth();
  const { businessId } = route.params;
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const params = status ? `?status=${status}` : '';
    request<{ bookings: BookingRecord[] }>(`/api/businesses/${businessId}/bookings${params}`)
      .then((body) => {
        if (!cancelled) {
          setBookings(body.bookings);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load bookings.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, request, status]);

  useFocusEffect(load);

  function act(booking: BookingRecord, action: 'confirm' | 'complete' | 'no-show' | 'cancel') {
    const run = () => {
      void request(`/api/bookings/${booking.id}/${action}`, { method: 'POST' })
        .then(() => load())
        .catch((caught: unknown) => {
          setError(caught instanceof ApiError ? caught.message : 'Unable to update this booking.');
        });
    };
    if (action !== 'cancel') {
      run();
      return;
    }
    Alert.alert('Cancel this booking?', 'The time will become available again.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <ScrollScreen>
      <View style={styles.chips}>
        {filters.map((filter) => {
          const active = filter.value === status;
          return (
            <Pressable
              accessibilityRole="button"
              key={filter.label}
              onPress={() => setStatus(filter.value)}
              style={[styles.chip, active ? styles.chipActive : null]}
            >
              <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>{filter.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {loading ? <ActivityIndicator style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && bookings.length === 0 ? (
        <Text style={styles.empty}>No bookings match this filter.</Text>
      ) : null}
      {bookings.map((booking) => (
        <View key={booking.id}>
          <ListCard
            lines={[
              booking.service.name,
              formatWhen(booking.startsAt),
              booking.customerPhone,
              bookingStatusLabels[booking.status],
            ]}
            title={booking.customerName}
          />
          <View style={styles.actions}>
            {booking.status === 'PENDING' ? (
              <Action label="Confirm" onPress={() => act(booking, 'confirm')} />
            ) : null}
            {booking.status === 'CONFIRMED' ? (
              <>
                <Action label="Complete" onPress={() => act(booking, 'complete')} />
                <Action label="No-show" onPress={() => act(booking, 'no-show')} />
              </>
            ) : null}
            {booking.status === 'PENDING' || booking.status === 'CONFIRMED' ? (
              <Action label="Cancel" onPress={() => act(booking, 'cancel')} />
            ) : null}
          </View>
        </View>
      ))}
    </ScrollScreen>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.action}>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  empty: {
    color: '#3f3832',
    fontSize: 16,
  },
  spinner: {
    marginVertical: 24,
  },
  error: {
    color: '#7f1d1d',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
    marginTop: -4,
  },
  action: {
    minHeight: 32,
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#1c1915',
    fontSize: 15,
    fontWeight: '600',
  },
});
