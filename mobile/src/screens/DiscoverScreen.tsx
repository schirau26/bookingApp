import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ListCard, PrimaryButton, ScrollScreen, SecondaryButton } from '../components/Form';
import { useAuth } from '../context/AuthContext';
import type { CustomerStackParamList } from '../navigation/types';
import { ApiError } from '../services/api';
import {
  WEEKDAYS,
  formatMoney,
  formatRating,
  type BusinessCard,
  type Category,
  type Weekday,
} from '../types/business';

type Props = NativeStackScreenProps<CustomerStackParamList, 'Discover'>;
type Sort = 'rating' | 'reviews' | 'price' | 'name';

type Filters = {
  q: string;
  category: string | null;
  location: string;
  minRating: string;
  maxPrice: string;
  openOn: Weekday | '';
  sort: Sort;
};

const initialFilters: Filters = {
  q: '',
  category: null,
  location: '',
  minRating: '',
  maxPrice: '',
  openOn: '',
  sort: 'rating',
};

const sorts: { value: Sort; label: string }[] = [
  { value: 'rating', label: 'Rating' },
  { value: 'reviews', label: 'Most reviewed' },
  { value: 'price', label: 'Price' },
  { value: 'name', label: 'Name' },
];

export function DiscoverScreen({ navigation }: Props) {
  const { request } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<BusinessCard[]>([]);
  const [draft, setDraft] = useState(initialFilters);
  const [applied, setApplied] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (filters: Filters, nextPage: number) => {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
        sort: filters.sort,
      });
      if (filters.q) params.set('q', filters.q);
      if (filters.category) params.set('category', filters.category);
      if (filters.location) params.set('location', filters.location);
      if (filters.minRating) params.set('minRating', filters.minRating);
      if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
      if (filters.openOn) params.set('openOn', filters.openOn);
      return request<{ businesses: BusinessCard[]; total: number }>(
        `/api/businesses?${params.toString()}`,
      );
    },
    [request],
  );

  useEffect(() => {
    let cancelled = false;
    request<{ categories: Category[] }>('/api/categories')
      .then((body) => {
        if (!cancelled) setCategories(body.categories);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [request]);

  useEffect(() => {
    let cancelled = false;
    fetchPage(applied, 1)
      .then((body) => {
        if (cancelled) return;
        setBusinesses(body.businesses);
        setTotal(body.total);
        setPage(1);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : 'Unable to load businesses.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applied, fetchPage]);

  async function refresh() {
    setRefreshing(true);
    try {
      const body = await fetchPage(applied, 1);
      setBusinesses(body.businesses);
      setTotal(body.total);
      setPage(1);
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to load businesses.');
    } finally {
      setRefreshing(false);
    }
  }

  function applySearch() {
    setLoading(true);
    setApplied((current) => ({ ...current, q: draft.q.trim() }));
  }

  return (
    <ScrollScreen onRefresh={() => void refresh()} refreshing={refreshing}>
      <Text style={styles.intro}>Approved businesses you can book in a later phase.</Text>
      <TextInput
        accessibilityLabel="Search businesses"
        autoCapitalize="none"
        onChangeText={(q) => setDraft((current) => ({ ...current, q }))}
        onSubmitEditing={applySearch}
        placeholder="Search by business or service"
        placeholderTextColor="#8a8175"
        returnKeyType="search"
        style={styles.search}
        value={draft.q}
      />
      <ChoiceRow
        onSelect={(category) => {
          setLoading(true);
          setDraft((current) => ({ ...current, category }));
          setApplied((current) => ({ ...current, category, q: draft.q.trim() }));
        }}
        options={[
          { label: 'All', value: null },
          ...categories.map((item) => ({ label: item.name, value: item.slug })),
        ]}
        selected={applied.category}
      />
      <SecondaryButton
        label={showFilters ? 'Hide filters' : 'Filters'}
        onPress={() => setShowFilters((value) => !value)}
      />
      {showFilters ? (
        <View>
          <TextInput
            accessibilityLabel="Location"
            onChangeText={(location) => setDraft((current) => ({ ...current, location }))}
            placeholder="Location"
            placeholderTextColor="#8a8175"
            style={styles.search}
            value={draft.location}
          />
          <Text style={styles.filterLabel}>Minimum rating</Text>
          <ChoiceRow
            onSelect={(minRating) => setDraft((current) => ({ ...current, minRating }))}
            options={[
              { label: 'Any', value: '' },
              { label: '3+', value: '3' },
              { label: '4+', value: '4' },
            ]}
            selected={draft.minRating}
          />
          <TextInput
            accessibilityLabel="Maximum price"
            keyboardType="decimal-pad"
            onChangeText={(maxPrice) => setDraft((current) => ({ ...current, maxPrice }))}
            placeholder="Maximum price"
            placeholderTextColor="#8a8175"
            style={styles.search}
            value={draft.maxPrice}
          />
          <Text style={styles.filterLabel}>Open on</Text>
          <ChoiceRow
            onSelect={(openOn) => setDraft((current) => ({ ...current, openOn }))}
            options={[
              { label: 'Any day', value: '' as const },
              ...WEEKDAYS.map((day) => ({ label: day.label, value: day.value })),
            ]}
            selected={draft.openOn}
          />
          <Text style={styles.filterLabel}>Sort</Text>
          <ChoiceRow
            onSelect={(sort) => setDraft((current) => ({ ...current, sort }))}
            options={sorts}
            selected={draft.sort}
          />
          <PrimaryButton
            label="Apply filters"
            onPress={() => {
              setLoading(true);
              setApplied({
                ...draft,
                q: draft.q.trim(),
                location: draft.location.trim(),
                maxPrice: draft.maxPrice.trim(),
              });
            }}
          />
        </View>
      ) : null}
      {loading ? <ActivityIndicator style={styles.spinner} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && !error && businesses.length === 0 ? (
        <Text style={styles.empty}>No approved businesses match these filters.</Text>
      ) : null}
      {businesses.map((business) => (
        <ListCard
          key={business.id}
          lines={[
            business.category.name,
            business.address,
            formatRating(business.averageRating, business.reviewCount),
            `From ${formatMoney(business.startingPrice)}`,
          ]}
          onPress={() => navigation.navigate('BusinessDetail', { businessId: business.id })}
          title={business.name}
        />
      ))}
      {!loading && businesses.length < total ? (
        <PrimaryButton
          label="Load more"
          onPress={() => {
            void fetchPage(applied, page + 1)
              .then((body) => {
                setBusinesses((current) => [...current, ...body.businesses]);
                setTotal(body.total);
                setPage((current) => current + 1);
              })
              .catch((caught: unknown) => {
                setError(caught instanceof ApiError ? caught.message : 'Unable to load businesses.');
              });
          }}
        />
      ) : null}
    </ScrollScreen>
  );
}

function ChoiceRow<T extends string | null>({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: T }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const active = option.value === selected;
        return (
          <Pressable
            accessibilityRole="button"
            key={`${option.label}-${String(option.value)}`}
            onPress={() => onSelect(option.value)}
            style={[styles.chip, active ? styles.chipActive : null]}
          >
            <Text style={[styles.chipLabel, active ? styles.chipLabelActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    color: '#3f3832',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
  },
  search: {
    backgroundColor: '#fff',
    borderColor: '#e4ddd2',
    borderRadius: 12,
    borderWidth: 1,
    color: '#1c1915',
    fontSize: 16,
    marginBottom: 12,
    marginTop: 4,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
  filterLabel: {
    color: '#3f3832',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  spinner: {
    marginVertical: 24,
  },
  error: {
    color: '#7f1d1d',
    marginBottom: 12,
  },
  empty: {
    color: '#3f3832',
    fontSize: 16,
    marginTop: 12,
  },
});
