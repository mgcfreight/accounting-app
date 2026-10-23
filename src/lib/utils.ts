// Words that start with a letter or digit only, so "Day & Ross" is "DR".
export const createInitials = (name: string) =>
  name
    .split(" ")
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

export const fullName = (person: { firstName: string; lastName: string }) =>
  `${person.firstName} ${person.lastName}`;

// Timestamps are stored in UTC and shown in Toronto time (design §11).
const TIME_ZONE = "America/Toronto";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// A date-only value ("2026-10-14": invoice, due and payment dates) is a
// calendar date, not an instant. `new Date("2026-10-14")` is UTC midnight,
// which in Toronto is the evening before — formatting it in Toronto time
// would show every due date a day early. So calendar dates are formatted in
// UTC, unchanged; full timestamps are converted to Toronto time.
export const formatDate = (date?: string) => {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: DATE_ONLY.test(date) ? "UTC" : TIME_ZONE,
  });
};

export const formatDateTime = (date?: string) => {
  if (!date) return null;
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
};

// Lower-case label for an enum value: PARTIALLY_PAID -> "Partially paid".
export const humanize = (value: string) =>
  value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");

// Today's calendar date in Toronto, "2026-10-14", to compare with the
// API's date-only values.
export const torontoToday = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());

const pad = (value: number) => String(value).padStart(2, "0");

// The wall-clock parts of an instant in Toronto.
const torontoParts = (instant: number) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
};

// Now in Toronto, as a datetime-local input wants it: "2026-10-21T14:05".
export const torontoNowLocal = () => {
  const p = torontoParts(Date.now());
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

// A datetime-local value read as Toronto time, as an ISO date-time with its
// offset: "2026-10-21T14:05" -> "2026-10-21T14:05:00-04:00". The browser's
// own time zone plays no part.
export const torontoLocalToIso = (local: string) => {
  const asUtc = Date.parse(`${local}:00Z`);
  const offsetAt = (instant: number) => {
    const p = torontoParts(instant);
    return (
      (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - instant) / 60_000
    );
  };
  // Twice, so a time near a DST change gets the offset in force at it.
  const offset = offsetAt(asUtc - offsetAt(asUtc) * 60_000);
  const abs = Math.abs(offset);
  return `${local}:00${offset < 0 ? "-" : "+"}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};
