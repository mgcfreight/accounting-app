import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AlertBanner, BaseButton, BaseInput, BaseTable } from "@/components/common";
import { useServerPaging } from "@/hooks";
import { ExchangeRate, ExchangeRateRefresh } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";
import { ApiError, errorMessage, fetchExchangeRates, listExchangeRates } from "@/services";

const columns: BaseTableColumn[] = [
  { key: "date", label: "Date" },
  { key: "rateToCad", label: "USD to CAD" },
  { key: "observedOn", label: "Bank Day" },
  { key: "source", label: "Source" },
  { key: "fetchedAt", label: "Fetched" },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const sourceLabels: Record<string, string> = { BANK_OF_CANADA: "Bank of Canada" };

const refreshSummary = (result: ExchangeRateRefresh) => {
  const { customer_invoices, carrier_invoices, customer_payments, carrier_payments } =
    result.filled;
  return (
    `${result.stored} days stored; rates filled on ${customer_invoices} shipper ` +
    `invoices, ${carrier_invoices} carrier bills and ` +
    `${customer_payments + carrier_payments} payments.`
  );
};

// The Bank of Canada's daily USD rate to CAD (exchange_rates), fetched by
// the API every day at 17:30 Toronto time. A weekend or holiday holds the
// business day before it. "Fetch now" does the same at once and fills USD
// records that have no rate; it never replaces a rate typed in by staff.
export default function ExchangeRates() {
  const queryClient = useQueryClient();
  const { control } = useForm<{ from: string; to: string }>({
    defaultValues: { from: "", to: "" },
  });
  const from = useWatch({ control, name: "from" });
  const to = useWatch({ control, name: "to" });
  // A half-typed date is left out rather than sent.
  const range = {
    from: DATE.test(from) ? from : undefined,
    to: DATE.test(to) ? to : undefined,
  };
  const paging = useServerPaging(JSON.stringify(range), 20);
  const params = { page: paging.page, limit: paging.limit, ...range };
  const rates = useQuery({
    queryKey: ["exchange-rates", params],
    queryFn: ({ signal }) => listExchangeRates(params, signal),
    placeholderData: keepPreviousData,
  });

  const fetchNow = useMutation({
    mutationFn: fetchExchangeRates,
    onSuccess: (result) => {
      toast.success(`Exchange rates fetched: ${refreshSummary(result)}`);
      void queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      // 409: the daily fetch is already running; show what it stored.
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: ["exchange-rates"] });
      }
    },
  });

  return (
    <div className="border-t-1 py-6 flex flex-col gap-4">
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div className="flex flex-wrap gap-3">
          <BaseInput
            name="from"
            control={control}
            type="date"
            label="From"
            placeholder=" "
            className="w-full sm:w-44"
          />
          <BaseInput
            name="to"
            control={control}
            type="date"
            label="To"
            placeholder=" "
            className="w-full sm:w-44"
          />
        </div>
        <BaseButton
          text="Fetch now"
          className="rounded-full px-6"
          isLoading={fetchNow.isPending}
          onPress={() => fetchNow.mutate()}
        />
      </div>
      {rates.isError && (
        <AlertBanner
          message={`Couldn't load exchange rates: ${errorMessage(rates.error)}`}
          action={
            <button type="button" className="underline text-sm" onClick={() => void rates.refetch()}>
              Retry
            </button>
          }
        />
      )}
      <BaseTable<ExchangeRate>
        ariaLabel="Exchange rates"
        columns={columns}
        data={rates.isError ? [] : (rates.data?.items ?? [])}
        loading={rates.isPending}
        refreshing={rates.isPlaceholderData}
        rowKey={(row) => `${row.date}-${row.currency}`}
        meta={paging.tableMeta(rates.data?.meta)}
        setMeta={paging.setMeta}
        bottomContent="Days"
        emptyContent={rates.isError ? "Couldn't load exchange rates." : "No rates stored yet."}
        renderCell={(row, key) => {
          switch (key) {
            case "date":
              return <span className="font-semibold">{formatDate(row.date)}</span>;
            case "rateToCad":
              // Shown exactly as stored, never re-rounded.
              return <span className="font-mono">{row.rateToCad}</span>;
            case "observedOn":
              return row.observedOn === row.date ? (
                <span className="text-gray-400">Same day</span>
              ) : (
                formatDate(row.observedOn)
              );
            case "source":
              return sourceLabels[row.source] ?? row.source;
            case "fetchedAt":
              return <span className="whitespace-nowrap">{formatDateTime(row.fetchedAt)}</span>;
            default:
              return null;
          }
        }}
      />
    </div>
  );
}
