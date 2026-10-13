import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { OwnerHomeStackParamList, OwnerRootParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import {
  bookingStatusLabels,
  vehicleSizeLabels,
  type BookingRecord,
  type BookingStatus,
} from '../types/booking';
import type { OwnerBusiness } from '../types/business';
import { formatTime, windhoekDate } from '../utils/schedule';

type IconName = ComponentProps<typeof Ionicons>['name'];

const statusMeta: Record<BookingStatus, { color: string; icon: IconName; tint: string }> = {
  CONFIRMED: { color: colors.goldInk, icon: 'checkmark-circle', tint: '#FFF6D8' },
  ARRIVED: { color: colors.arrived, icon: 'car-sport', tint: '#E7EEF8' },
  WASHING: { color: colors.washing, icon: 'water', tint: '#F3E8FF' },
  READY: { color: colors.ready, icon: 'checkmark-circle', tint: '#E7F6EC' },
  COMPLETED: { color: colors.ready, icon: 'checkmark-done', tint: '#E7F6EC' },
  CANCELLED: { color: colors.danger, icon: 'close-circle', tint: '#FDECEC' },
  NO_SHOW: { color: colors.danger, icon: 'alert-circle', tint: '#FDECEC' },
};

type Props = CompositeScreenProps<
  NativeStackScreenProps<OwnerHomeStackParamList, 'OwnerQueue'>,
  NativeStackScreenProps<OwnerRootParamList>
>;

const filters: { label: string; value: BookingStatus | '' }[] = [
  { label: 'All', value: '' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Arrived', value: 'ARRIVED' },
  { label: 'Washing', value: 'WASHING' },
  { label: 'Ready', value: 'READY' },
  { label: 'Completed', value: 'COMPLETED' },
];

export function OwnerBookingsScreen({ navigation }: Props) {
  const { request } = useAuth();
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [shop, setShop] = useState<{ name: string; bayCount: number } | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ date: windhoekDate() });
    if (status) params.set('status', status);

    request<{ businesses: OwnerBusiness[] }>('/api/businesses/mine')
      .then(async (body) => {
        const wash = body.businesses[0];
        if (!wash) throw new ApiError('Wash not found', 404);
        if (cancelled) return;
        setShop({ name: wash.name, bayCount: wash.bayCount });
        return request<{ bookings: BookingRecord[] }>(`/api/businesses/${wash.id}/bookings?${params.toString()}`);
      })
      .then((body) => {
        if (!cancelled && body) {
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
  }, [request, status]);

  useFocusEffect(load);

  function act(booking: BookingRecord, action: 'arrive' | 'wash' | 'ready' | 'complete' | 'no-show' | 'cancel') {
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
    Alert.alert('Cancel this booking?', 'The bay will become available again.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <ScrollScreen>
      <Text style={styles.heading}>Today</Text>
      <View style={styles.subRow}>
        <Text style={styles.sub}>{shop?.name ?? 'Urban Glow Car Wash'} · Bay queue</Text>
        {shop ? (
          <Text style={styles.bays}>
            <Text style={styles.bayDot}>● </Text>
            {shop.bayCount} bays
          </Text>
        ) : null}
      </View>
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
      {loading ? <ActivityIndicator color={colors.ink} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && bookings.length === 0 ? (
        <Text style={styles.empty}>No washes match this filter.</Text>
      ) : null}
      {bookings.map((booking, index) => {
        const meta = statusMeta[booking.status];
        return (
          <View key={booking.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.badge, { backgroundColor: meta.tint }]}>
                <Text style={[styles.badgeLabel, { color: meta.color }]}>{index + 1}</Text>
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.customer}>{booking.customerName}</Text>
                <Text style={styles.packageName}>{booking.service.name}</Text>
              </View>
              <View style={styles.when}>
                <Text style={styles.time}>{formatTime(booking.startsAt)}</Text>
                <Text style={styles.registration}>{booking.registration}</Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <Ionicons color={meta.color} name={meta.icon} size={16} />
              <Text style={[styles.statusLabel, { color: meta.color }]}>
                {bookingStatusLabels[booking.status].toUpperCase()}
              </Text>
              <Text style={styles.size}>{vehicleSizeLabels[booking.vehicleSize]}</Text>
            </View>
            <View style={styles.actions}>
              {booking.status === 'CONFIRMED' ? (
                <>
                  <QueueButton label="Arrived" onPress={() => act(booking, 'arrive')} />
                  <QueueButton label="No-show" onPress={() => act(booking, 'no-show')} />
                  <QueueButton label="Cancel" onPress={() => act(booking, 'cancel')} />
                </>
              ) : null}
              {booking.status === 'ARRIVED' ? (
                <QueueButton label="Start wash" onPress={() => act(booking, 'wash')} tone="blue" />
              ) : null}
              {booking.status === 'WASHING' ? (
                <QueueButton label="Ready" onPress={() => act(booking, 'ready')} tone="gold" />
              ) : null}
              {booking.status === 'READY' ? (
                <QueueButton label="Completed" onPress={() => act(booking, 'complete')} />
              ) : null}
              {booking.invoice ? (
                <QueueButton
                  label="Invoice"
                  onPress={() => navigation.navigate('Invoice', { bookingId: booking.id })}
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </ScrollScreen>
  );
}

function QueueButton({
  label,
  onPress,
  tone = 'plain',
}: {
  label: string;
  onPress: () => void;
  tone?: 'plain' | 'blue' | 'gold';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[
        styles.queueButton,
        tone === 'blue' ? styles.queueBlue : null,
        tone === 'gold' ? styles.queueGold : null,
        tone === 'plain' ? null : styles.queueFill,
      ]}
    >
      <Text style={[styles.queueLabel, tone === 'blue' ? styles.queueLabelLight : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '700',
  },
  subRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    marginBottom: 14,
    marginTop: 4,
  },
  sub: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
  },
  bays: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  bayDot: {
    color: colors.lime,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.lime,
    borderColor: colors.lime,
  },
  chipLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  chipLabelActive: {
    color: colors.ink,
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    marginBottom: 12,
    padding: 14,
  },
  cardTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  badgeLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardCopy: {
    flex: 1,
  },
  customer: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  packageName: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  when: {
    alignItems: 'flex-end',
  },
  time: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  registration: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  size: {
    color: colors.muted,
    flex: 1,
    fontSize: 12,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  queueButton: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    borderRadius: 12,
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  queueFill: {
    flexBasis: '100%',
  },
  queueBlue: {
    backgroundColor: colors.blue,
  },
  queueGold: {
    backgroundColor: colors.lime,
  },
  queueLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  queueLabelLight: {
    color: colors.white,
  },
});
