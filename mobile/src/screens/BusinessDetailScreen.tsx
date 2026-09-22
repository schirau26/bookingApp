import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { ListCard, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { CustomerStackParamList } from '../navigation/types';
import { ApiError, mediaUrl } from '../services/api';
import {
  WEEKDAYS,
  formatDuration,
  formatMoney,
  formatRating,
  type PublicBusiness,
  type PublicService,
} from '../types/business';
import { formatStars, type PublicReview } from '../types/review';

type Props = NativeStackScreenProps<CustomerStackParamList, 'BusinessDetail'>;

export function BusinessDetailScreen({ navigation, route }: Props) {
  const { request } = useAuth();
  const [business, setBusiness] = useState<PublicBusiness | null>(null);
  const [services, setServices] = useState<PublicService[]>([]);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const id = route.params.businessId;
    Promise.all([
      request<{ business: PublicBusiness }>(`/api/businesses/${id}`),
      request<{ services: PublicService[] }>(`/api/businesses/${id}/services`),
      request<{ reviews: PublicReview[] }>(`/api/businesses/${id}/reviews`),
    ])
      .then(([detail, serviceBody, reviewBody]) => {
        if (cancelled) return;
        setBusiness(detail.business);
        setServices(serviceBody.services);
        setReviews(reviewBody.reviews);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load this business.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [request, route.params.businessId]);

  if (error) {
    return (
      <ScrollScreen>
        <Text style={styles.error}>{error}</Text>
      </ScrollScreen>
    );
  }

  if (!business) {
    return (
      <ScrollScreen>
        <ActivityIndicator />
      </ScrollScreen>
    );
  }

  const logo = mediaUrl(business.logoUrl);

  return (
    <ScrollScreen>
      {logo ? <Image source={{ uri: logo }} style={styles.logo} /> : null}
      <Text style={styles.category}>{business.category.name}</Text>
      <Text style={styles.title}>{business.name}</Text>
      <Text style={styles.body}>{business.description}</Text>
      <Text style={styles.body}>{business.address}</Text>
      <Text style={styles.body}>{business.phone}</Text>
      <Text style={styles.body}>{business.email}</Text>
      <Text style={styles.body}>{formatRating(business.averageRating, business.reviewCount)}</Text>
      {business.photos.length > 0 ? (
        <View style={styles.photos}>
          {business.photos.map((photo) => (
            <Image key={photo.id} source={{ uri: mediaUrl(photo.url) ?? '' }} style={styles.photo} />
          ))}
        </View>
      ) : null}
      <Text style={styles.section}>Hours</Text>
      {business.workingHours.length === 0 ? <Text style={styles.body}>Hours are not listed yet.</Text> : null}
      {business.workingHours.map((day) => {
        const label = WEEKDAYS.find((item) => item.value === day.dayOfWeek)?.label ?? day.dayOfWeek;
        return (
          <Text key={day.dayOfWeek} style={styles.body}>
            {label}: {day.isClosed ? 'Closed' : `${day.openTime}–${day.closeTime}`}
          </Text>
        );
      })}
      <Text style={styles.section}>Services</Text>
      {services.length === 0 ? <Text style={styles.body}>No active services yet.</Text> : null}
      {services.map((service) => (
        <ListCard
          key={service.id}
          lines={[service.description, `${formatMoney(service.price)} · ${formatDuration(service.durationMinutes)}`]}
          onPress={() => navigation.navigate('Book', { businessId: business.id, serviceId: service.id })}
          title={service.name}
        />
      ))}
      <Text style={styles.section}>Reviews</Text>
      {reviews.length === 0 ? <Text style={styles.body}>No reviews yet.</Text> : null}
      {reviews.map((review) => (
        <View key={review.id} style={styles.review}>
          <Text style={styles.body}>
            {review.authorName} · {formatStars(review.rating)}
          </Text>
          <Text style={styles.body}>{review.body}</Text>
          {review.replyBody ? <Text style={styles.reply}>Owner: {review.replyBody}</Text> : null}
          {review.photos.length > 0 ? (
            <View style={styles.photos}>
              {review.photos.map((photo) => (
                <Image key={photo.id} source={{ uri: mediaUrl(photo.url) ?? '' }} style={styles.photo} />
              ))}
            </View>
          ) : null}
        </View>
      ))}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  logo: {
    borderRadius: 16,
    height: 96,
    marginBottom: 16,
    width: 96,
  },
  category: {
    color: '#6b6256',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  title: {
    color: '#1c1915',
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 12,
  },
  body: {
    color: '#3f3832',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 6,
  },
  section: {
    color: '#1c1915',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 20,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  photo: {
    borderRadius: 12,
    height: 96,
    width: 96,
  },
  review: {
    marginBottom: 12,
  },
  reply: {
    color: '#6b6256',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 6,
  },
  error: {
    color: '#7f1d1d',
  },
});
