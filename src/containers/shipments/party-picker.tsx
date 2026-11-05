import { Autocomplete, AutocompleteItem } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FieldValues, Path, useController, Control } from "react-hook-form";
import { useDebouncedValue } from "@/hooks";
import { PartyType } from "@/lib/enums";
import { listParties } from "@/services";

// Picks an active shipper or carrier by name or MGC id, searched by the API
// as you type. The field holds the party's id ("" for none).
export default function PartyPicker<T extends FieldValues>({
  control,
  name,
  type,
  label,
  description,
  isRequired = false,
}: {
  control: Control<T>;
  name: Path<T>;
  type: PartyType;
  label: string;
  description?: string;
  isRequired?: boolean;
}) {
  const what = type === PartyType.Shipper ? "shipper" : "carrier";
  const {
    field: { value, onChange, onBlur },
    fieldState: { error },
  } = useController({
    control,
    name,
    rules: isRequired ? { required: `Choose a ${what}` } : undefined,
  });
  const [input, setInput] = useState("");
  const [pickedName, setPickedName] = useState("");
  // Picking a party fills the box with its name; that isn't a new search, so
  // the list stays as it was rather than asking the API for that one name.
  const typed = input.trim();
  const search = useDebouncedValue(typed === pickedName ? "" : typed);

  const params = {
    page: 1,
    limit: 20,
    type,
    isActive: true,
    searchQuery: search.slice(0, 100),
  };
  const parties = useQuery({
    queryKey: ["parties", "list", params],
    queryFn: ({ signal }) => listParties(params, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <Autocomplete
      label={label}
      variant="bordered"
      placeholder={`Search ${what}s by name or MGC id`}
      items={parties.data?.items ?? []}
      inputValue={input}
      onInputChange={setInput}
      selectedKey={value || null}
      onSelectionChange={(key) => {
        const id = key ? String(key) : "";
        const picked = parties.data?.items.find((party) => party.id === id);
        setPickedName(picked?.name.trim() ?? "");
        onChange(id);
      }}
      onBlur={onBlur}
      // The API has already filtered by what was typed.
      defaultFilter={() => true}
      isLoading={parties.isFetching}
      isInvalid={!!error || parties.isError}
      errorMessage={
        error?.message ?? (parties.isError ? `Couldn't load the ${what}s` : undefined)
      }
      description={description}
      isRequired={isRequired}
    >
      {(party) => (
        <AutocompleteItem key={party.id} textValue={party.name}>
          <div className="flex flex-col">
            <span className="text-sm">{party.name}</span>
            <span className="text-xs text-gray-500">
              MGC {party.mgcId} · {party.defaultCurrency}
            </span>
          </div>
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
}
