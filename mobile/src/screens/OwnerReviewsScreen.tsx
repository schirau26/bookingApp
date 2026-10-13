import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { OwnerRootParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import { colors } from '../theme/colors';
import type { PublicReview } from '../types/review';

type Props = NativeStackScreenProps<OwnerRootParamList, 'OwnerReviews'>;

export function OwnerReviewsScreen({ route }: Props) {
  const { request } = useAuth();
  const { businessId } = route.params;
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    request<{ reviews: PublicReview[] }>(`/api/businesses/${businessId}/reviews`)
      .then((body) => {
        if (cancelled) return;
        setReviews(body.reviews);
        setReplies(Object.fromEntries(body.reviews.map((review) => [review.id, review.replyBody ?? ''])));
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load reviews.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, request]);

  useFocusEffect(load);

  async function reply(reviewId: string) {
    setError(null);
    try {
      await request(`/api/reviews/${reviewId}/reply`, {
        method: 'PUT',
        body: { body: replies[reviewId] ?? '' },
      });
      load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save the reply.');
    }
  }

  async function report(reviewId: string) {
    setError(null);
    try {
      await request(`/api/reviews/${reviewId}/reports`, {
        method: 'POST',
        body: { reason: reasons[reviewId] ?? '' },
      });
      load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to report this review.');
    }
  }

  return (
    <ScrollScreen>
      {loading ? <ActivityIndicator color={colors.ink} style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && reviews.length === 0 ? <Text style={styles.empty}>No reviews yet.</Text> : null}
      {reviews.map((review) => (
        <View key={review.id} style={styles.card}>
          <Text style={styles.author}>{review.authorName}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Ionicons
                color={colors.lime}
                key={value}
                name={value <= review.rating ? 'star' : 'star-outline'}
                size={16}
              />
            ))}
          </View>
          <Text style={styles.body}>{review.body}</Text>
          <TextInput
            accessibilityLabel={`Reply to ${review.authorName}`}
            multiline
            onChangeText={(value) => setReplies((current) => ({ ...current, [review.id]: value }))}
            placeholder="Reply"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={replies[review.id] ?? ''}
          />
          <PrimaryButton label="Save reply" onPress={() => void reply(review.id)} />
          {review.reportedByMe ? (
            <Text style={styles.note}>You reported this review. It stays visible until an admin decides.</Text>
          ) : (
            <>
              <TextInput
                accessibilityLabel={`Report reason for ${review.authorName}`}
                onChangeText={(value) => setReasons((current) => ({ ...current, [review.id]: value }))}
                placeholder="Reason for a report"
                placeholderTextColor={colors.muted}
                style={styles.input}
                value={reasons[review.id] ?? ''}
              />
              <PrimaryButton label="Report review" onPress={() => void report(review.id)} tone="blue" />
              <Text style={styles.note}>A report does not hide the review.</Text>
            </>
          )}
        </View>
      ))}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    marginBottom: 16,
    padding: 14,
  },
  author: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
    marginVertical: 6,
  },
  body: {
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    marginBottom: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  note: {
    color: colors.muted,
    marginBottom: 16,
    marginTop: 8,
  },
});
