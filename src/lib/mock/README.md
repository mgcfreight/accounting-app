# Mock data

Every screen reads from these files until the Accounts API exists. Replace an
import from `@/lib/mock` with a call through `services/` when the endpoint is
ready; the shapes in `lib/interfaces` are what the screens expect.

The numbers are hand-checked so they agree with each other, because a demo
with totals that don't add up costs a reviewer's trust:

- Tax is per line at the destination-province rate (design §8.3), rounded
  half-up: ON HST 13%, NB HST 15%, QC GST 5% + QST 9.975%, AB/BC/SK GST 5%,
  cross-border 0%.
- total = subtotal + tax; balance = total − payments. Draft and void invoices
  carry no receivable or payable balance.
- Party balances, dashboard totals and aging buckets are sums of the open
  invoice balances below.

The frontend never does this arithmetic — the API will send every figure
already calculated. The mock is written the same way.
