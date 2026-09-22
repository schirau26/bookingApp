import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ListCard, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { CustomerStackParamList, OwnerStackParamList } from '../navigation/types';
import { ApiError } from '../services/api';

type CustomerProps = NativeStackScreenProps<CustomerStackParamList, 'Notifications'>;
type OwnerProps = NativeStackScreenProps<OwnerStackParamList, 'Notifications'>;

type InboxNotification = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  booking: { id: string; businessId: string } | null;
  review: { id: string; businessId: string } | null;
};

export function NotificationsScreen({ navigation }: CustomerProps | OwnerProps) {
  const { request, user } = useAuth();
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    request<{ notifications: InboxNotification[]; unreadCount: number }>('/api/notifications')
      .then((body) => {
        if (cancelled) return;
        setNotifications(body.notifications);
        setUnreadCount(body.unreadCount);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load notifications.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  useFocusEffect(load);

  function open(item: InboxNotification) {
    if (!item.isRead) {
      void request(`/api/notifications/${item.id}`, { method: 'PATCH', body: { isRead: true } });
    }
    if (user?.role === 'BUSINESS_OWNER') {
      const ownerNavigation = navigation as OwnerProps['navigation'];
      if (item.booking) ownerNavigation.navigate('OwnerBookings', { businessId: item.booking.businessId });
      else if (item.review) ownerNavigation.navigate('OwnerReviews', { businessId: item.review.businessId });
      return;
    }
    const customerNavigation = navigation as CustomerProps['navigation'];
    if (item.booking) customerNavigation.navigate('MyBookings');
    else if (item.review) customerNavigation.navigate('BusinessDetail', { businessId: item.review.businessId });
  }

  function toggleRead(item: InboxNotification) {
    void request(`/api/notifications/${item.id}`, { method: 'PATCH', body: { isRead: !item.isRead } })
      .then(() => load())
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught.message : 'Unable to update this notification.');
      });
  }

  return (
    <ScrollScreen>
      {loading ? <ActivityIndicator style={styles.spinner} /> : null}
      {!loading && !error ? (
        <Text style={styles.summary}>{unreadCount === 0 ? 'You are caught up.' : `${unreadCount} unread`}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && notifications.length === 0 ? (
        <Text style={styles.empty}>No notifications yet.</Text>
      ) : null}
      {notifications.map((item) => (
        <View key={item.id}>
          <ListCard lines={[item.message]} onPress={() => open(item)} title={item.title} unread={!item.isRead} />
          <Pressable accessibilityRole="button" onPress={() => toggleRead(item)} style={styles.toggle}>
            <Text style={styles.toggleLabel}>{item.isRead ? 'Mark unread' : 'Mark read'}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  summary: {
    color: '#3f3832',
    fontSize: 16,
    marginBottom: 12,
  },
  spinner: {
    marginVertical: 24,
  },
  empty: {
    color: '#3f3832',
    fontSize: 16,
  },
  error: {
    color: '#7f1d1d',
    marginBottom: 12,
  },
  toggle: {
    marginTop: -8,
    marginBottom: 16,
  },
  toggleLabel: {
    color: '#1c1915',
    fontSize: 15,
    fontWeight: '600',
  },
});
