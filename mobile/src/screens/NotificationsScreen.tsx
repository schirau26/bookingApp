import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ListCard, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';

type InboxNotification = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  booking: { id: string; businessId: string } | null;
  review: { id: string; businessId: string } | null;
};

type LooseNav = {
  navigate: (screen: string, params?: object) => void;
  getParent: () => LooseNav | undefined;
};

export function NotificationsScreen() {
  const navigation = useNavigation() as unknown as LooseNav;
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
    const tabs = navigation.getParent();
    const root = tabs?.getParent() ?? navigation;
    if (user?.role === 'BUSINESS_OWNER') {
      if (item.booking) {
        tabs?.navigate('HomeTab', { screen: 'OwnerQueue' });
      } else if (item.review) {
        root.navigate('OwnerReviews', { businessId: item.review.businessId });
      }
      return;
    }
    if (item.booking) tabs?.navigate('BookingsTab', { screen: 'MyBookings' });
    else if (item.review) {
      tabs?.navigate('HomeTab', { screen: 'WashHome' });
    }
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
      {loading ? <ActivityIndicator color={colors.ink} style={styles.spinner} /> : null}
      {!loading && !error ? (
        <Text style={styles.summary}>{unreadCount === 0 ? 'You are caught up.' : `${unreadCount} unread`}</Text>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && notifications.length === 0 ? (
        <Text style={styles.empty}>No notifications yet.</Text>
      ) : null}
      {notifications.map((item) => (
        <View key={item.id}>
          <ListCard
            icon="notifications-outline"
            lines={[item.message]}
            onPress={() => open(item)}
            title={item.title}
            unread={!item.isRead}
          />
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
    color: colors.inkSoft,
    fontSize: 16,
    marginBottom: 12,
  },
  spinner: {
    marginVertical: 24,
  },
  empty: {
    color: colors.muted,
    fontSize: 16,
  },
  error: {
    color: colors.danger,
    marginBottom: 12,
  },
  toggle: {
    marginTop: -8,
    marginBottom: 16,
  },
  toggleLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
});
