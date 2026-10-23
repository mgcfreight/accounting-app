import { useQuery } from "@tanstack/react-query";
import {
  ArrayPath,
  Control,
  FieldArray,
  FieldValues,
  Path,
  useFieldArray,
} from "react-hook-form";
import { BaseButton, BaseInput, BaseSelect } from "@/components/common";
import { QUANTITY_PATTERN, UNIT_PRICE_PATTERN } from "@/lib/constants";
import { Charge, getChargeTypes } from "@/services";

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
// of them. Amounts and tax are calculated by the API.
export default function ChargeLines<T extends FieldValues>({
  control,
  name,
  priceLabel = "Unit price",
}: {
  control: Control<T>;
  name: ArrayPath<T>;
  priceLabel?: string;
}) {
  const chargeTypes = useQuery({
    queryKey: ["charge-types"],
    queryFn: ({ signal }) => getChargeTypes(signal),
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

  return (
    <div className="flex flex-col gap-3">
      {chargeTypes.isError && (
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
      )}
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
            className="sm:col-span-4"
            rules={{ maxLength: { value: 255, message: "At most 255 characters" } }}
          />
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
          <BaseInput
            name={path(index, "unitPrice")}
            control={control}
            label={priceLabel}
            placeholder="0.00"
            className="sm:col-span-2"
            rules={{
              required: "Required",
              pattern: { value: UNIT_PRICE_PATTERN, message: "Up to 4 decimals" },
            }}
          />
          <div className="sm:col-span-1 flex sm:pt-2">
            {fields.length > 1 && (
              <BaseButton
                text="Remove"
                varient="light"
                className="text-base-danger px-2 min-w-0"
                onPress={() => remove(index)}
              />
            )}
          </div>
        </div>
      ))}
      {fields.length < MAX_LINES && (
        <BaseButton
          text="Add line"
          varient="bordered"
          className="text-base-primary w-fit px-4"
          onPress={() => append(emptyCharge as FieldArray<T, ArrayPath<T>>)}
        />
      )}
    </div>
  );
}
