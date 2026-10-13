import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Field, PrimaryButton, ScrollScreen, SecondaryButton } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { CustomerRootParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { ApiError, mediaUrl } from '../services/api';
import { pickImage } from '../services/images';
import type { PublicReview } from '../types/review';

type Props = NativeStackScreenProps<CustomerRootParamList, 'ReviewForm'>;

export function ReviewFormScreen({ navigation, route }: Props) {
  const { request, upload } = useAuth();
  const { businessId, bookingId } = route.params;
  const [reviewId, setReviewId] = useState(route.params.reviewId);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PublicReview['photos']>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!reviewId) return;
    let cancelled = false;
    request<{ reviews: PublicReview[] }>(`/api/businesses/${businessId}/reviews`)
      .then((result) => {
        const review = result.reviews.find((item) => item.id === reviewId);
        if (!review || cancelled) return;
        setRating(review.rating);
        setBody(review.body);
        setPhotos(review.photos);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load this review.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, request, reviewId]);

  async function save() {
    if (!body.trim()) {
      setError('Validation failed');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (reviewId) {
        await request(`/api/reviews/${reviewId}`, { method: 'PATCH', body: { rating, body } });
        navigation.goBack();
        return;
      }
      const created = await request<{ review: PublicReview }>('/api/reviews', {
        method: 'POST',
        body: { bookingId, rating, body },
      });
      setReviewId(created.review.id);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to save this review.');
    } finally {
      setSubmitting(false);
    }
  }

  async function addPhoto() {
    if (!reviewId) return;
    setError(null);
    try {
      const form = await pickImage();
      if (!form) return;
      const saved = await upload<{ photo: { id: string; url: string } }>(
        `/api/reviews/${reviewId}/photos`,
        form,
      );
      setPhotos((current) => [...current, saved.photo]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to upload the photo.');
    }
  }

  function removePhoto(photoId: string) {
    if (!reviewId) return;
    void request(`/api/reviews/${reviewId}/photos/${photoId}`, { method: 'DELETE' })
      .then(() => setPhotos((current) => current.filter((photo) => photo.id !== photoId)))
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught.message : 'Unable to remove the photo.');
      });
  }

  function removeReview() {
    if (!reviewId) return;
    Alert.alert('Delete this review?', 'You can write another one later.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void request(`/api/reviews/${reviewId}`, { method: 'DELETE' })
            .then(() => navigation.goBack())
            .catch((caught: unknown) => {
              setError(caught instanceof ApiError ? caught.message : 'Unable to delete this review.');
            });
        },
      },
    ]);
  }

  return (
    <ScrollScreen>
      <Text style={styles.label}>Rating</Text>
      <View style={styles.ratings}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
            key={value}
            onPress={() => setRating(value)}
          >
            <Ionicons color={colors.lime} name={value <= rating ? 'star' : 'star-outline'} size={32} />
          </Pressable>
        ))}
      </View>
      <Field
        autoCapitalize="sentences"
        label="Review"
        multiline
        onChangeText={setBody}
        value={body}
      />
      {reviewId ? (
        <>
          <Text style={styles.label}>Photos</Text>
          <View style={styles.photos}>
            {photos.map((photo) => (
              <Pressable accessibilityRole="button" key={photo.id} onPress={() => removePhoto(photo.id)}>
                <Image source={{ uri: mediaUrl(photo.url) ?? '' }} style={styles.photo} />
              </Pressable>
            ))}
          </View>
          <SecondaryButton label="Add photo" onPress={() => void addPhoto()} />
        </>
      ) : (
        <Text style={styles.hint}>Save the review first, then you can add photos.</Text>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        disabled={submitting}
        label={submitting ? 'Saving…' : reviewId ? 'Save changes' : 'Submit review'}
        onPress={() => void save()}
      />
      {reviewId ? <SecondaryButton label="Delete review" onPress={removeReview} /> : null}
      {reviewId && route.params.reviewId !== reviewId ? (
        <SecondaryButton label="Done" onPress={() => navigation.goBack()} />
      ) : null}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  ratings: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 16,
  },
  hint: {
    color: colors.muted,
    marginBottom: 12,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  photo: {
    borderRadius: 12,
    height: 88,
    width: 88,
  },
  error: {
    color: colors.danger,
    marginBottom: 8,
  },
});
