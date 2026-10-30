import { Currency } from "./enums";

// Money arrives as a 2-decimal string ("2450.00"). It is formatted here as a
// string and is never parsed into a float, so what is displayed is exactly the
// value sent. The currency code is always printed: "$" alone cannot tell CAD
// from USD, and this app shows both side by side.
//
// Arithmetic on money does not belong in the frontend. Totals, tax and
// balances come already calculated. The one exception is sumMoney, which
// checks a form's amounts before they are sent; never display its result as
// an official total.

const AMOUNT_PATTERN = /^(-)?(\d+)\.(\d{2})$/;

export const isMoneyString = (value: unknown): value is string =>
  typeof value === "string" && AMOUNT_PATTERN.test(value);

// Returns null for anything that is not a well-formed amount, so the caller
// has to render an explicit placeholder rather than a wrong number.
export const formatMoney = (
  amount: string | null | undefined,
  currency: Currency
): string | null => {
  if (!isMoneyString(amount)) return null;
  const [, sign, whole, cents] = amount.match(AMOUNT_PATTERN)!;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign ? "-" : ""}${currency} ${grouped}.${cents}`;
};

export const isZeroMoney = (amount: string) => /^-?0+\.00$/.test(amount);

// Orders two amounts exactly, by comparing digits rather than converting to
// floats. Used for sorting table columns; malformed amounts sort as equal.
export const compareMoney = (a: string, b: string): number => {
  const ma = a.match(AMOUNT_PATTERN);
  const mb = b.match(AMOUNT_PATTERN);
  if (!ma || !mb) return 0;
  const negA = !!ma[1] && !isZeroMoney(a);
  const negB = !!mb[1] && !isZeroMoney(b);
  if (negA !== negB) return negA ? -1 : 1;
  const digitsA = `${ma[2].replace(/^0+(?=\d)/, "")}${ma[3]}`;
  const digitsB = `${mb[2].replace(/^0+(?=\d)/, "")}${mb[3]}`;
  const magnitude =
    digitsA.length !== digitsB.length
      ? digitsA.length - digitsB.length
      : digitsA < digitsB
        ? -1
        : digitsA > digitsB
          ? 1
          : 0;
  return negA ? -magnitude : magnitude;
};

// Adds amounts exactly, in whole cents (BigInt, never floats). Returns null if
// any amount is malformed, so the caller cannot mistake a bad input for 0.00.
export const sumMoney = (amounts: string[]): string | null => {
  let total = BigInt(0);
  for (const amount of amounts) {
    const match = amount.match(AMOUNT_PATTERN);
    if (!match) return null;
    const cents = BigInt(`${match[2]}${match[3]}`);
    total += match[1] ? -cents : cents;
  }
  const negative = total < BigInt(0);
  const digits = (negative ? -total : total).toString().padStart(3, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -2)}.${digits.slice(-2)}`;
};
