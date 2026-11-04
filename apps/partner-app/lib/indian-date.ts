/** Consistent Indian-style UI dates. Keep ISO/API values unchanged. */
const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_FIRST_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const pad = (value: number) => String(value).padStart(2, '0');

export function formatAppDate(value?: string | Date | null, empty = '-'): string {
  if (!value) return empty;
  if (typeof value === 'string') {
    const input = value.trim();
    const iso = input.match(ISO_DATE_ONLY);
    if (iso) {
      const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
      const valid = new Date(Date.UTC(year, month - 1, day));
      return valid.getUTCFullYear() === year && valid.getUTCMonth() === month - 1 && valid.getUTCDate() === day
        ? `${iso[3]}/${iso[2]}/${iso[1]}` : empty;
    }
    if (DAY_FIRST_DATE.test(input)) return input;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? empty
    : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function formatAppDateTime(value?: string | Date | null, empty = '-'): string {
  if (!value) return empty;
  const formattedDate = formatAppDate(value, empty);
  if (formattedDate === empty) return empty;
  if (typeof value === 'string' && (ISO_DATE_ONLY.test(value.trim()) || DAY_FIRST_DATE.test(value.trim()))) return formattedDate;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return empty;
  const hours = date.getHours() % 12 || 12;
  const suffix = date.getHours() >= 12 ? 'PM' : 'AM';
  return `${formattedDate}, ${pad(hours)}:${pad(date.getMinutes())} ${suffix}`;
}
