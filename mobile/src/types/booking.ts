export type BookingStatus =
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'WASHING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type VehicleSize = 'HATCHBACK' | 'SEDAN' | 'SUV' | 'BAKKIE' | 'VAN';

export type BookingRecord = {
  id: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  note: string | null;
  vehicleSize: VehicleSize;
  registration: string;
  make: string | null;
  color: string | null;
  price: string;
  durationMinutes: number;
  status: BookingStatus;
  business: { id: string; name: string };
  service: { id: string; name: string };
  review: { id: string } | null;
  invoice: { id: string; number: string; status: 'UNPAID' | 'PAID'; total: string } | null;
};

export const bookingStatusLabels: Record<BookingStatus, string> = {
  CONFIRMED: 'Confirmed',
  ARRIVED: 'Arrived',
  WASHING: 'Washing',
  READY: 'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};

export const vehicleSizeLabels: Record<VehicleSize, string> = {
  HATCHBACK: 'Hatchback',
  SEDAN: 'Sedan',
  SUV: 'SUV',
  BAKKIE: 'Bakkie',
  VAN: 'Van',
};
