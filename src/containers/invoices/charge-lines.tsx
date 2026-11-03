import { Tooltip } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { ReactNode } from "react";
import {
  ArrayPath,
  Control,
  FieldArray,
  FieldValues,
  Path,
  useFieldArray,
} from "react-hook-form";
import { BaseButton, BaseInput, BaseSelect } from "@/components/common";
import { Trash } from "@/components/icons";
import { QUANTITY_PATTERN, UNIT_PRICE_PATTERN } from "@/lib/constants";
import { InvoiceLineView } from "@/lib/interfaces";
import { Charge, getInvoiceChargeTypes } from "@/services";

// One charge as typed: every field a string, as the API takes it.
export type ChargeValues = {
  chargeTypeCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

export const emptyCharge: ChargeValues = {
  chargeTypeCode: "",
  description: "",
  quantity: "1",
  unitPrice: "",
};

const MAX_LINES = 50;

// An invoice's lines as form rows, to start a new version from: the values
// exactly as the API sent them, never re-formatted.
export const chargesFrom = (lines: InvoiceLineView[]): ChargeValues[] =>
  lines.length === 0
    ? [emptyCharge]
    : lines.map((line) => ({
        chargeTypeCode: line.chargeTypeCode,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      }));

// The same rows for a form without a quantity field: each line as quantity 1
// at the line amount the API calculated, so no hidden multiplier sits behind
// the price field and the total is unchanged until a price is edited.
export const amountChargesFrom = (lines: InvoiceLineView[]): ChargeValues[] =>
  lines.length === 0
    ? [emptyCharge]
    : lines.map((line) => ({
        chargeTypeCode: line.chargeTypeCode,
        description: line.description,
        quantity: "1",
        unitPrice: line.amount,
      }));

// What the API takes; a blank description falls back to the charge type's
// name.
export const toCharges = (lines: ChargeValues[]): Charge[] =>
  lines.map((line) => ({
    chargeTypeCode: line.chargeTypeCode,
    quantity: line.quantity.trim(),
    unitPrice: line.unitPrice.trim(),
    ...(line.description.trim() && { description: line.description.trim() }),
  }));

// The charge lines of a form (a carrier bill, a shipment's customer or
// carrier charges): charge type, description, quantity and unit price, 1-50
// of them. Amounts and tax are calculated by the API. Without the quantity
// field every line is quantity 1, so start its rows from amountChargesFrom.
// `layout="table"` shows them as an invoice's table: headings once, compact
// numbered rows and `footer` (a total) under them.
export default function ChargeLines<T extends FieldValues>({
  control,
  name,
  priceLabel = "Unit price",
  showQuantity = true,
  layout = "rows",
  footer,
}: {
  control: Control<T>;
  name: ArrayPath<T>;
  priceLabel?: string;
  showQuantity?: boolean;
  layout?: "rows" | "table";
  footer?: ReactNode;
}) {
  // Under ["charge-types"], so a change in Settings refreshes these too.
  const chargeTypes = useQuery({
    queryKey: ["charge-types", "active"],
    queryFn: ({ signal }) => getInvoiceChargeTypes(signal),
    staleTime: 5 * 60_000,
  });
  const options = (chargeTypes.data ?? []).map((type) => ({
    key: type.code,
    label: type.name,
    value: type.code,
  }));
  const { fields, append, remove } = useFieldArray({ control, name });
  const path = (index: number, field: keyof ChargeValues) =>
    `${name}.${index}.${field}` as Path<T>;
  const add = () => append(emptyCharge as FieldArray<T, ArrayPath<T>>);

  const loadError = chargeTypes.isError && (
    <p className="text-xs text-base-danger">
      Couldn&apos;t load the charge types.{" "}
      <button
        type="button"
        className="underline"
        onClick={() => void chargeTypes.refetch()}
      >
        Try again
      </button>
    </p>
  );

  if (layout === "table") {
    // One grid for the headings and every row, so the columns line up.
    const columns = showQuantity
      ? "sm:grid-cols-[1.5rem_minmax(0,3fr)_minmax(0,4fr)_minmax(0,1.5fr)_minmax(0,2fr)_2rem]"
      : "sm:grid-cols-[1.5rem_minmax(0,3fr)_minmax(0,4fr)_minmax(0,2fr)_2rem]";
    // The heading, shown above each field on a phone where there's no
    // heading row.
    const cell = (heading: string, child: ReactNode, className = "") => (
      <div className={`flex flex-col gap-1 ${className}`}>
        <span className="text-xs text-content-5 sm:hidden">{heading}</span>
        {child}
      </div>
    );
    return (
      <div className="flex flex-col gap-2">
        {loadError}
        <div className="rounded-lg border border-base-default">
          <div
            aria-hidden
            className={`hidden gap-3 border-b border-base-default bg-content-2 px-3 py-2 text-xs font-semibold text-[#343A40] sm:grid ${columns}`}
          >
            <span>#</span>
            <span>Charge</span>
            <span>Description</span>
            {showQuantity && <span>Qty</span>}
            <span className="text-right">{priceLabel}</span>
            <span />
          </div>
          <ol>
            {fields.map((field, index) => (
              <li
                key={field.id}
                className={`grid grid-cols-1 items-start gap-3 border-b border-content-3 px-3 py-2.5 last:border-b-0 sm:gap-y-0 ${columns}`}
              >
                <span className="pt-0 text-xs font-semibold text-content-5 sm:pt-2">
                  <span className="sm:hidden">Charge </span>
                  {index + 1}
                </span>
                {cell(
                  "Charge",
                  <BaseSelect
                    name={path(index, "chargeTypeCode")}
                    control={control}
                    aria-label={`Charge ${index + 1}`}
                    placeholder="Choose a charge"
                    size="sm"
                    options={options}
                    isLoading={chargeTypes.isPending}
                    rules={{ required: "Choose a charge" }}
                  />
                )}
                {cell(
                  "Description",
                  <BaseInput
                    name={path(index, "description")}
                    control={control}
                    aria-label={`Description ${index + 1}`}
                    placeholder="Optional"
                    size="sm"
                    rules={{ maxLength: { value: 255, message: "At most 255 characters" } }}
                  />
                )}
                {showQuantity &&
                  cell(
                    "Qty",
                    <BaseInput
                      name={path(index, "quantity")}
                      control={control}
                      aria-label={`Quantity ${index + 1}`}
                      size="sm"
                      rules={{
                        required: "Required",
                        pattern: { value: QUANTITY_PATTERN, message: "Above 0, ≤3 decimals" },
                      }}
                    />
                  )}
                {cell(
                  priceLabel,
                  <BaseInput
                    name={path(index, "unitPrice")}
                    control={control}
                    aria-label={`${priceLabel} ${index + 1}`}
                    placeholder="0.00"
                    size="sm"
                    inputMode="decimal"
                    classNames={{ input: "text-xs text-right tabular-nums" }}
                    rules={{
                      required: "Required",
                      pattern: { value: UNIT_PRICE_PATTERN, message: "Up to 4 decimals" },
                    }}
                  />
                )}
                <div className="flex justify-end sm:pt-0.5">
                  {fields.length > 1 && (
                    <RemoveButton label={`Remove charge ${index + 1}`} onRemove={() => remove(index)} small />
                  )}
                </div>
              </li>
            ))}
          </ol>
          {fields.length < MAX_LINES && (
            <div className="border-t border-content-3 p-2">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-medium border-2 border-dashed border-content-4 py-2 text-sm text-base-primary transition-colors hover:border-base-primary hover:bg-content-12 focus-visible:outline-2 focus-visible:outline-focus"
                onClick={add}
              >
                <span aria-hidden className="text-base leading-none">
                  +
                </span>
                Add Additional Charges
              </button>
            </div>
          )}
          {footer && <div className="border-t border-base-default px-3 py-3">{footer}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {loadError}
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start border-b border-gray-100 pb-3"
        >
          <BaseSelect
            name={path(index, "chargeTypeCode")}
            control={control}
            label="Charge"
            options={options}
            isLoading={chargeTypes.isPending}
            className="sm:col-span-3"
            rules={{ required: "Choose a charge" }}
          />
          <BaseInput
            name={path(index, "description")}
            control={control}
            label="Description"
            placeholder="Optional"
            className={showQuantity ? "sm:col-span-4" : "sm:col-span-5"}
            rules={{ maxLength: { value: 255, message: "At most 255 characters" } }}
          />
          {showQuantity && (
            <BaseInput
              name={path(index, "quantity")}
              control={control}
              label="Qty"
              className="sm:col-span-2"
              rules={{
                required: "Required",
                pattern: { value: QUANTITY_PATTERN, message: "Above 0, ≤3 decimals" },
              }}
            />
          )}
          <BaseInput
            name={path(index, "unitPrice")}
            control={control}
            label={priceLabel}
            placeholder="0.00"
            className={showQuantity ? "sm:col-span-2" : "sm:col-span-3"}
            rules={{
              required: "Required",
              pattern: { value: UNIT_PRICE_PATTERN, message: "Up to 4 decimals" },
            }}
          />
          <div className="sm:col-span-1 flex sm:h-14 sm:items-center">
            {fields.length > 1 && (
              <RemoveButton label="Remove charge" onRemove={() => remove(index)} />
            )}
          </div>
        </div>
      ))}
      {fields.length < MAX_LINES && (
        <BaseButton
          text="Add Additional Charges"
          // The kit's Add icon is drawn in white, for solid buttons only.
          startContent={
            <span aria-hidden className="text-base leading-none">
              +
            </span>
          }
          varient="bordered"
          className="text-base-primary w-fit px-4"
          onPress={add}
        />
      )}
    </div>
  );
}

// A native button, not BaseButton: HeroUI presses on pointer up, the next
// row's button then slides under the pointer, and the click that follows
// presses that one too. A native click needs the press to start on the same
// button.
function RemoveButton({
  label,
  onRemove,
  small = false,
}: {
  label: string;
  onRemove: () => void;
  small?: boolean;
}) {
  return (
    <Tooltip content="Remove this charge" closeDelay={0}>
      <button
        type="button"
        aria-label={label}
        className={`flex items-center justify-center rounded-full transition-colors hover:bg-danger-50 focus-visible:outline-2 focus-visible:outline-focus ${
          small ? "h-8 w-8" : "h-10 w-10"
        }`}
        onClick={onRemove}
      >
        <Trash className={small ? "h-4 w-4" : "h-5 w-5"} aria-hidden />
      </button>
    </Tooltip>
  );
}
