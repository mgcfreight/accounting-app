import { UNIT_PRICE_PATTERN } from "./constants";
import { Currency } from "./enums";

// Money arrives as a 2-decimal string ("2450.00"). It is formatted here as a
// string and is never parsed into a float, so what is displayed is exactly the
// value sent. The currency code is always printed: "$" alone cannot tell CAD
// from USD, and this app shows both side by side.
//
// Arithmetic on money does not belong in the frontend. Totals, tax and
// balances come already calculated. The exceptions are form helpers: sumMoney,
// which checks a form's amounts before they are sent, and commissionPercent,
// which previews the commission on a shipper or carrier invoice's new
// version. Commission is shown on screen only: it must never appear on a
// carrier invoice PDF or anything sent to the carrier. Never display their
// results as an official total.

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
  return fromScaled(total, 2);
};

// A non-negative decimal string as a whole number of 1/10^places units, or
// null if it has more decimals than that.
const toScaled = (value: string, places: number): bigint | null => {
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > places) return null;
  return BigInt(`${whole}${fraction.padEnd(places, "0")}`);
};

// The reverse of toScaled, with exactly `places` decimals.
const fromScaled = (value: bigint, places: number): string => {
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value)
    .toString()
    .padStart(places + 1, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -places)}.${digits.slice(-places)}`;
};

// n / d to the nearest whole number, halves away from zero (half up).
const divideHalfUp = (n: bigint, d: bigint): bigint => {
  const negative = n < BigInt(0);
  const magnitude = (BigInt(2) * (negative ? -n : n) + d) / (BigInt(2) * d);
  return negative ? -magnitude : magnitude;
};

// A base price as typed or sent: 0 or more, up to 2 decimals ("400", "400.5").
const BASE_PATTERN = /^\d+(\.\d{1,2})?$/;

// A typed amount ("450", "450.5") as an amount string ("450.00", "450.50"),
// so it can go through sumMoney. Null for anything else, including more than
// 2 decimals.
export const toAmount = (value: string): string | null =>
  BASE_PATTERN.test(value) ? fromScaled(toScaled(value, 2)!, 2) : null;

// The commission % a customer rate puts on a base price, to 2 decimals, half
// up, without trailing zeros ("10", "12.5"). Negative when the rate is below
// the base. Null for a zero or malformed base, or a rate that isn't a unit
// price (up to 4 decimals). Only for showing: the rate is what gets sent.
export const commissionPercent = (cost: string, price: string): string | null => {
  if (!BASE_PATTERN.test(cost) || !UNIT_PRICE_PATTERN.test(price)) {
    return null;
  }
  const costUnits = toScaled(cost, 2)! * BigInt(100);
  if (costUnits === BigInt(0)) return null;
  const priceUnits = toScaled(price, 4)!;
  const hundredths = divideHalfUp(
    (priceUnits - costUnits) * BigInt(10000),
    costUnits
  );
  return fromScaled(hundredths, 2).replace(/\.?0+$/, "") || "0";
};
