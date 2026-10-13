import { Ionicons } from '@expo/vector-icons';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { PackageCard } from '../components/PackageCard';
import { PrimaryButton, ScrollScreen } from '../components/Form';
import { RiseIn } from '../components/motion';
import { useAuth } from '../context/AuthContext';
import type { CustomerRootParamList, HomeStackParamList } from '../navigation/types';
import { ApiError, mediaUrl } from '../services/api';
import { colors } from '../theme/colors';
import { groupByCategory } from '../theme/packageArt';
import {
  WEEKDAYS,
  formatMoney,
  formatRating,
  type Wash,
  type Weekday,
  type WorkingHour,
} from '../types/business';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'WashHome'>,
  NativeStackScreenProps<CustomerRootParamList>
>;

const banner = require('../../assets/urban-glow-banner.jpg');
const mark = require('../../assets/icon.png');

function hoursLine(day: WorkingHour) {
  if (day.isClosed || !day.openTime || !day.closeTime) return 'Closed';
  return `${day.openTime}–${day.closeTime}`;
}

function weekdayInWindhoek() {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Windhoek',
    weekday: 'long',
  }).format(new Date());
  return label.toUpperCase() as Weekday;
}

export function WashHomeScreen({ navigation }: Props) {
  const { request } = useAuth();
  const [wash, setWash] = useState<Wash | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    request<{ wash: Wash }>('/api/wash')
      .then((body) => {
        if (!cancelled) {
          setWash(body.wash);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof ApiError ? caught.message : 'Unable to load the wash.');
      });
    return () => {
      cancelled = true;
    };
  }, [request]);

  useFocusEffect(load);

  if (!wash) {
    return (
      <ScrollScreen>
        {error ? <Text style={styles.error}>{error}</Text> : <Text style={styles.loading}>Loading…</Text>}
      </ScrollScreen>
    );
  }

  const hero = wash.photos[0] ? mediaUrl(wash.photos[0].url) : null;
  const groups = groupByCategory(wash.packages).map((group, groupIndex, all) => {
    const earlier = all.slice(0, groupIndex).reduce((sum, entry) => sum + entry.items.length, 0);
    return {
      ...group,
      items: group.items.map((pack, itemIndex) => ({
        pack,
        delay: 40 + (earlier + itemIndex) * 70,
      })),
    };
  });
  const today = weekdayInWindhoek();
  const hours = WEEKDAYS.map((entry) => wash.workingHours.find((day) => day.dayOfWeek === entry.value)).filter(
    (day): day is WorkingHour => Boolean(day),
  );
  return (
    <ScrollScreen>
      <Hero source={hero ? { uri: hero } : banner} />
      <View style={styles.heading}>
        <Image source={mark} style={styles.mark} />
        <Text style={styles.name}>{wash.name}</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Ionicons
              color={colors.lime}
              key={value}
              name={value <= Math.round(Number(wash.averageRating)) ? 'star' : 'star-outline'}
              size={14}
            />
          ))}
          <Text style={styles.rating}>{formatRating(wash.averageRating, wash.reviewCount)}</Text>
        </View>
        <Text style={styles.tagline}>More than a wash, we care.</Text>
      </View>

      <CategoryTitle title="Packages" />
      {groups.map((group) => (
        <View key={group.art.category}>
          <Text style={styles.category}>{group.art.category}</Text>
          <Text style={styles.categoryNote}>{group.art.note}</Text>
          {group.items.map(({ pack, delay }) => (
            <PackageCard
              delay={delay}
              key={pack.id}
              showCategory={false}
              onPress={() => navigation.navigate('Book', { packageId: pack.id })}
              pack={pack}
              priceLabel={pack.startingPrice ? `From ${formatMoney(pack.startingPrice)}` : 'Ask for a price'}
            />
          ))}
        </View>
      ))}

      <CategoryTitle title="Hours" />
      <RiseIn delay={80}>
        <View style={styles.panel}>
          {hours.map((day) => {
            const label = WEEKDAYS.find((item) => item.value === day.dayOfWeek)?.label ?? day.dayOfWeek;
            const openToday = day.dayOfWeek === today && !day.isClosed;
            return (
              <View key={day.dayOfWeek} style={styles.hourRow}>
                <Text style={[styles.hourDay, openToday ? styles.hourToday : null]}>{label}</Text>
                <Text style={[styles.hourValue, openToday ? styles.hourToday : null]}>{hoursLine(day)}</Text>
              </View>
            );
          })}
        </View>
      </RiseIn>

      <CategoryTitle title="Contact" />
      <RiseIn delay={140}>
        <View style={styles.panel}>
          <ContactRow detail={wash.phone} icon="call" name={wash.phoneContactName} />
          <ContactRow detail={wash.secondaryPhone} icon="call-outline" name={wash.secondaryContactName} />
          <ContactRow detail={wash.address} icon="location-outline" name="Shop" />
        </View>
      </RiseIn>

      <PrimaryButton label="Book a wash" onPress={() => navigation.navigate('Book', {})} />
    </ScrollScreen>
  );
}

function Hero({ source }: { source: number | { uri: string } }) {
  const [scale] = useState(() => new Animated.Value(1.08));

  useEffect(() => {
    Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [scale]);

  return (
    <View style={styles.hero}>
      <Animated.Image source={source} style={[styles.banner, { transform: [{ scale }] }]} />
    </View>
  );
}

function CategoryTitle({ title }: { title: string }) {
  return (
    <View style={styles.categoryTitle}>
      <View style={styles.categoryMark} />
      <Text style={styles.section}>{title}</Text>
    </View>
  );
}

function ContactRow({
  name,
  detail,
  icon,
}: {
  name: string;
  detail: string;
  icon: 'call' | 'call-outline' | 'location-outline';
}) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactIcon}>
        <Ionicons color={colors.ink} name={icon} size={18} />
      </View>
      <View style={styles.contactCopy}>
        <Text style={styles.contactName}>{name}</Text>
        <Text style={styles.contactDetail}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 28,
    height: 210,
    marginBottom: 16,
    overflow: 'hidden',
  },
  banner: {
    height: '100%',
    width: '100%',
  },
  heading: {
    alignItems: 'center',
    marginBottom: 8,
  },
  mark: {
    borderColor: colors.lime,
    borderRadius: 28,
    borderWidth: 2,
    height: 56,
    marginBottom: 10,
    width: 56,
  },
  name: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  ratingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginTop: 8,
  },
  rating: {
    color: colors.muted,
    marginLeft: 6,
  },
  tagline: {
    color: colors.inkSoft,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 8,
    textAlign: 'center',
  },
  categoryTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginTop: 22,
  },
  categoryMark: {
    backgroundColor: colors.lime,
    borderRadius: 3,
    height: 12,
    width: 12,
  },
  section: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
  },
  category: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  categoryNote: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 8,
    marginTop: 2,
  },
  panel: {
    backgroundColor: colors.card,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  hourRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  hourDay: {
    color: colors.inkSoft,
    fontSize: 15,
  },
  hourValue: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  hourToday: {
    color: colors.ink,
    fontWeight: '700',
  },
  contactRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  contactIcon: {
    alignItems: 'center',
    backgroundColor: colors.lime,
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  contactCopy: {
    flex: 1,
  },
  contactName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  contactDetail: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 2,
  },
  loading: {
    color: colors.muted,
  },
  error: {
    color: colors.danger,
  },
});
