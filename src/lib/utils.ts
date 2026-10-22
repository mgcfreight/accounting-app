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
