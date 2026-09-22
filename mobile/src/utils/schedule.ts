const TIME_ZONE = 'Africa/Windhoek';

export function windhoekDate(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function addDays(date: string, days: number) {
  const utc = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(utc).toISOString().slice(0, 10);
}

export function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${date}T12:00:00+02:00`));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

export function formatWhen(iso: string) {
  return `${formatDateLabel(windhoekDate(new Date(iso)))} · ${formatTime(iso)}`;
}
