import { Currency } from "@/lib/enums";
import { formatMoney } from "@/lib/money";

// Renders an amount exactly as given, always with its currency code. A
// malformed amount shows a visible marker rather than a plausible-looking
// number — see lib/money.ts.
export default function Money({
  amount,
  currency,
  className = "",
}: {
  amount: string | null | undefined;
  currency: Currency;
  className?: string;
}) {
  const text = formatMoney(amount, currency);
  if (text === null) {
    return (
      <span className={`text-base-danger ${className}`} title="Invalid amount">
        —
      </span>
    );
  }
  return <span className={`whitespace-nowrap ${className}`}>{text}</span>;
}
