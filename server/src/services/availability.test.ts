import { describe, expect, it } from 'vitest';
import { addCalendarDays, buildSlots, windhoekDate, windhoekDateTime } from './availability.js';

function startTimes(slots: { startsAt: Date }[]) {
  return slots.map((slot) => slot.startsAt.toISOString());
}

describe('buildSlots', () => {
  const date = '2026-09-23';
  const beforeOpening = windhoekDateTime('2026-09-22', '08:00');

  it('offers each duration step from opening until the last slot that finishes by closing', () => {
    const slots = buildSlots({
      date,
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: false,
      durationMinutes: 60,
      now: beforeOpening,
      blocking: [],
      bayCount: 1,
    });
    expect(startTimes(slots)).toEqual(
      ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'].map((time) =>
        windhoekDateTime(date, time).toISOString(),
      ),
    );
  });

  it('offers nothing on a closed day', () => {
    const slots = buildSlots({
      date,
      openTime: null,
      closeTime: null,
      isClosed: true,
      durationMinutes: 60,
      now: beforeOpening,
      blocking: [],
      bayCount: 1,
    });
    expect(slots).toEqual([]);
  });

  it('removes an overlapping slot and keeps the slot that starts when that booking ends', () => {
    const slots = buildSlots({
      date,
      openTime: '09:00',
      closeTime: '12:00',
      isClosed: false,
      durationMinutes: 60,
      now: beforeOpening,
      blocking: [
        {
          startsAt: windhoekDateTime(date, '09:00'),
          endsAt: windhoekDateTime(date, '10:00'),
        },
      ],
      bayCount: 1,
    });
    expect(startTimes(slots)).toEqual(
      ['10:00', '11:00'].map((time) => windhoekDateTime(date, time).toISOString()),
    );
  });

  it('omits a slot that has already started', () => {
    const slots = buildSlots({
      date,
      openTime: '09:00',
      closeTime: '12:00',
      isClosed: false,
      durationMinutes: 60,
      now: windhoekDateTime(date, '09:30'),
      blocking: [],
      bayCount: 1,
    });
    expect(startTimes(slots)).toEqual(
      ['10:00', '11:00'].map((time) => windhoekDateTime(date, time).toISOString()),
    );
  });

  it('offers nothing more than 60 days ahead', () => {
    const today = windhoekDate(beforeOpening);
    const slots = buildSlots({
      date: addCalendarDays(today, 61),
      openTime: '09:00',
      closeTime: '17:00',
      isClosed: false,
      durationMinutes: 60,
      now: beforeOpening,
      blocking: [],
      bayCount: 1,
    });
    expect(slots).toEqual([]);
  });

  it('keeps a time open until every bay is taken', () => {
    const occupied = {
      startsAt: windhoekDateTime(date, '09:00'),
      endsAt: windhoekDateTime(date, '10:00'),
    };
    const open = buildSlots({
      date,
      openTime: '09:00',
      closeTime: '11:00',
      isClosed: false,
      durationMinutes: 60,
      now: beforeOpening,
      blocking: [occupied],
      bayCount: 2,
    });
    const full = buildSlots({
      date,
      openTime: '09:00',
      closeTime: '11:00',
      isClosed: false,
      durationMinutes: 60,
      now: beforeOpening,
      blocking: [occupied, occupied],
      bayCount: 2,
    });
    expect(startTimes(open)).toContain(windhoekDateTime(date, '09:00').toISOString());
    expect(startTimes(full)).not.toContain(windhoekDateTime(date, '09:00').toISOString());
  });
});
