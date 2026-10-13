import type { ImageSourcePropType } from 'react-native';

const exterior = require('../../assets/packages/exterior.jpg') as ImageSourcePropType;
const interior = require('../../assets/packages/interior.jpg') as ImageSourcePropType;
const polish = require('../../assets/packages/polish.jpg') as ImageSourcePropType;
const wheels = require('../../assets/packages/wheels.jpg') as ImageSourcePropType;
const protect = require('../../assets/packages/protect.jpg') as ImageSourcePropType;

export type PackageArt = {
  image: ImageSourcePropType;
  category: string;
  note: string;
};

const catalog: Record<string, PackageArt> = {
  'car-sport-outline': {
    image: exterior,
    category: 'Exterior',
    note: 'Soap, rinse, and a dry of the bodywork',
  },
  'sparkles-outline': {
    image: interior,
    category: 'Interior',
    note: 'Vacuum and a wipe-down of the cabin',
  },
  'color-wand-outline': {
    image: polish,
    category: 'Polish',
    note: 'Paint shine finished with wax',
  },
  'ellipse-outline': {
    image: wheels,
    category: 'Wheels',
    note: 'Rims, arches, and tyres',
  },
  'shield-checkmark-outline': {
    image: protect,
    category: 'Protect',
    note: 'A finish that keeps the wash lasting',
  },
};

const fallback: PackageArt = {
  image: exterior,
  category: 'Service',
  note: 'A wash package',
};

export function artForIcon(icon: string): PackageArt {
  return catalog[icon] ?? fallback;
}

export function groupByCategory<T extends { icon: string }>(items: T[]) {
  const groups: { art: PackageArt; items: T[] }[] = [];
  for (const item of items) {
    const art = artForIcon(item.icon);
    const existing = groups.find((group) => group.art.category === art.category);
    if (existing) existing.items.push(item);
    else groups.push({ art, items: [item] });
  }
  return groups;
}
