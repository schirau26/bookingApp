export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

export type PublicBusiness = {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  averageRating: string;
  reviewCount: number;
  category: { id: string; name: string; slug: string };
  photos: { id: string; url: string; sortOrder: number }[];
  workingHours: WorkingHour[];
};

export type BusinessCard = {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  averageRating: string;
  reviewCount: number;
  startingPrice: string | null;
  category: { id: string; name: string; slug: string };
};

export type WorkingHour = {
  dayOfWeek: Weekday;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
};

export type PublicService = {
  id: string;
  name: string;
  description: string;
  price: string;
  durationMinutes: number;
  imageUrl: string | null;
};

export type OwnerService = PublicService & { isActive: boolean };

export type OwnerBusinessSummary = {
  id: string;
  name: string;
  address: string;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  category: { id: string; name: string; slug: string };
};

export type OwnerBusiness = {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  averageRating: string;
  reviewCount: number;
  category: { id: string; name: string; slug: string };
  photos: { id: string; url: string; sortOrder: number }[];
  workingHours: WorkingHour[];
  services: OwnerService[];
};

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

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

export const approvalLabels: Record<ApprovalStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  SUSPENDED: 'Suspended',
};

export function formatMoney(value: string | null) {
  return value ? `N$${value}` : 'No active services';
}

export function formatRating(average: string, count: number) {
  if (count === 0) return 'No reviews yet';
  return `${average} · ${count} ${count === 1 ? 'review' : 'reviews'}`;
}

export function formatDuration(minutes: number) {
  return `${minutes} min`;
}
