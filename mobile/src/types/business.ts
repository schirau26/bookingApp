import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { VehicleSize } from './booking';

export type { VehicleSize };

export const SERVICE_ICONS = [
  'car-sport-outline',
  'sparkles-outline',
  'color-wand-outline',
  'ellipse-outline',
  'shield-checkmark-outline',
  'water-outline',
  'brush-outline',
] as const satisfies readonly ComponentProps<typeof Ionicons>['name'][];

export type ServiceIcon = (typeof SERVICE_ICONS)[number];

export const DEFAULT_SERVICE_ICON: ServiceIcon = 'car-sport-outline';

export type PackagePrice = {
  vehicleSize: VehicleSize;
  price: string;
  durationMinutes: number;
};

export type WashPackage = {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  icon: string;
  startingPrice: string | null;
  prices: PackagePrice[];
  isActive?: boolean;
};

export type WorkingHour = {
  dayOfWeek: Weekday;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export type Wash = {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  phoneContactName: string;
  secondaryContactName: string;
  secondaryPhone: string;
  email: string;
  logoUrl: string | null;
  bayCount: number;
  averageRating: string;
  reviewCount: number;
  photos: { id: string; url: string; sortOrder: number }[];
  workingHours: WorkingHour[];
  packages: WashPackage[];
  owner: { fullName: string; profileImageUrl: string | null };
};

export type OwnerBusiness = Wash;

export type Weekday =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'MONDAY', label: 'Monday' },
  { value: 'TUESDAY', label: 'Tuesday' },
  { value: 'WEDNESDAY', label: 'Wednesday' },
  { value: 'THURSDAY', label: 'Thursday' },
  { value: 'FRIDAY', label: 'Friday' },
  { value: 'SATURDAY', label: 'Saturday' },
  { value: 'SUNDAY', label: 'Sunday' },
];

export const VEHICLE_SIZE_OPTIONS: { value: VehicleSize; label: string }[] = [
  { value: 'HATCHBACK', label: 'Hatchback' },
  { value: 'SEDAN', label: 'Sedan' },
  { value: 'SUV', label: 'SUV' },
  { value: 'BAKKIE', label: 'Bakkie' },
  { value: 'VAN', label: 'Van' },
];

export function formatMoney(value: string | null) {
  return value ? `N$${value}` : 'Ask for a price';
}

export function formatRating(average: string, count: number) {
  if (count === 0) return 'No reviews yet';
  return `${average} · ${count} ${count === 1 ? 'review' : 'reviews'}`;
}

export function formatDuration(minutes: number) {
  return `${minutes} min`;
}

export function priceFor(pack: WashPackage, size: VehicleSize) {
  return pack.prices.find((row) => row.vehicleSize === size) ?? null;
}
