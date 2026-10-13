import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { artForIcon } from '../theme/packageArt';
import type { WashPackage } from '../types/business';
import { PressableScale, RiseIn } from './motion';

export function PackageCard({
  pack,
  priceLabel,
  onPress,
  delay = 0,
  active = false,
  showCategory = true,
}: {
  pack: WashPackage;
  priceLabel: string;
  onPress: () => void;
  delay?: number;
  active?: boolean;
  showCategory?: boolean;
}) {
  const art = artForIcon(pack.icon);
  const from = priceLabel.startsWith('From ');
  const amount = from ? priceLabel.slice(5) : priceLabel;

  return (
    <RiseIn delay={delay}>
      <PressableScale
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.card, active ? styles.cardActive : null]}
      >
        <Image source={art.image} style={styles.photo} />
        <View style={styles.copy}>
          {showCategory ? (
            <Text style={[styles.category, active ? styles.categoryActive : null]}>{art.category}</Text>
          ) : null}
          <Text style={[styles.name, active ? styles.nameActive : null]}>{pack.name}</Text>
          <Text numberOfLines={2} style={[styles.description, active ? styles.descriptionActive : null]}>
            {pack.description}
          </Text>
        </View>
        <View style={styles.priceBlock}>
          {from ? <Text style={[styles.from, active ? styles.fromActive : null]}>From</Text> : null}
          <Text style={[styles.price, active ? styles.priceActive : null]}>{amount}</Text>
        </View>
      </PressableScale>
    </RiseIn>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
    padding: 12,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardActive: {
    backgroundColor: colors.ink,
  },
  photo: {
    borderRadius: 12,
    height: 64,
    width: 64,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  category: {
    color: colors.inkSoft,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  categoryActive: {
    color: colors.lime,
  },
  name: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '700',
  },
  nameActive: {
    color: colors.white,
  },
  description: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  descriptionActive: {
    color: colors.onInk,
  },
  priceBlock: {
    alignItems: 'flex-end',
    maxWidth: 88,
  },
  from: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  fromActive: {
    color: colors.onInk,
  },
  price: {
    color: colors.goldInk,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  priceActive: {
    color: colors.lime,
  },
});
