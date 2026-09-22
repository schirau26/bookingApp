import type { DayOfWeek } from '../generated/prisma/client.js';

export const BUSINESS_TIME_ZONE = 'Africa/Windhoek';
const OFFSET = '+02:00';
export const MAX_DAYS_AHEAD = 60;

const weekdays: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
];

export type TimeRange = {
  startsAt: Date;
  endsAt: Date;
};

export function windhoekDate(instant: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

export function addCalendarDays(date: string, days: number) {
  const utc = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(utc).toISOString().slice(0, 10);
}

export function calendarDaysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function weekdayInWindhoek(date: string): DayOfWeek {
  const noon = new Date(`${date}T12:00:00${OFFSET}`);
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: 'long',
  })
    .format(noon)
    .toUpperCase();
  const match = weekdays.find((day) => day === name);
  if (!match) throw new Error(`Unknown weekday ${name}`);
  return match;
}

export function windhoekDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00${OFFSET}`);
}

export function windhoekDayBounds(date: string) {
  return {
    start: windhoekDateTime(date, '00:00'),
    end: windhoekDateTime(addCalendarDays(date, 1), '00:00'),
  };
}

export function rangesOverlap(left: TimeRange, right: TimeRange) {
  return left.startsAt.getTime() < right.endsAt.getTime() && left.endsAt.getTime() > right.startsAt.getTime();
}

export function buildSlots(input: {
  date: string;
  openTime: string | null;
  closeTime: string | null;
  isClosed: boolean;
  durationMinutes: number;
  now: Date;
  blocking: TimeRange[];
}): TimeRange[] {
  const distance = calendarDaysBetween(windhoekDate(input.now), input.date);
  if (distance < 0 || distance > MAX_DAYS_AHEAD) return [];
  if (input.isClosed || !input.openTime || !input.closeTime || input.durationMinutes < 1) return [];

  const open = windhoekDateTime(input.date, input.openTime);
  const close = windhoekDateTime(input.date, input.closeTime);
  const durationMs = input.durationMinutes * 60_000;
  const slots: TimeRange[] = [];

  for (let start = open.getTime(); start + durationMs <= close.getTime(); start += durationMs) {
    const slot = { startsAt: new Date(start), endsAt: new Date(start + durationMs) };
    if (slot.startsAt.getTime() <= input.now.getTime()) continue;
    if (input.blocking.some((booking) => rangesOverlap(booking, slot))) continue;
    slots.push(slot);
  }

  return slots;
}
