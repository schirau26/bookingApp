import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ListCard, PrimaryButton, ScrollScreen } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { OwnerStackParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import { approvalLabels, type OwnerBusinessSummary } from '../types/business';

type Props = NativeStackScreenProps<OwnerStackParamList, 'MyBusinesses'>;

export function MyBusinessesScreen({ navigation }: Props) {
  const { request } = useAuth();
  const [businesses, setBusinesses] = useState<OwnerBusinessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    request<{ businesses: OwnerBusinessSummary[] }>('/api/businesses/mine')
      .then((body) => {
        if (!cancelled) setBusinesses(body.businesses);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load your businesses.');
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

  return (
    <ScrollScreen>
      <Text style={styles.intro}>Create a business, then add services, hours, and photos.</Text>
      <PrimaryButton label="New business" onPress={() => navigation.navigate('BusinessForm', {})} />
      {loading ? <ActivityIndicator style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && businesses.length === 0 ? (
        <Text style={styles.empty}>You have not added a business yet.</Text>
      ) : null}
      {businesses.map((business) => (
        <ListCard
          key={business.id}
          lines={[
            business.category.name,
            business.address,
            approvalLabels[business.approvalStatus],
            business.rejectionReason ?? '',
          ].filter(Boolean)}
          onPress={() => navigation.navigate('ManageBusiness', { businessId: business.id })}
          title={business.name}
        />
      ))}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: '#3f3832',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  spinner: {
    marginVertical: 24,
  },
  error: {
    color: '#7f1d1d',
    marginTop: 12,
  },
  empty: {
    color: '#3f3832',
    marginTop: 16,
  },
});
