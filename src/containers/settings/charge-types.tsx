import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseInput,
  BaseSwitch,
  BaseTable,
  FormModal,
  RowActions,
  StatusChip,
} from "@/components/common";
import { Add, EditSm } from "@/components/icons";
import { useServerPaging } from "@/hooks";
import { ChargeType } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import {
  createChargeType,
  errorMessage,
  listChargeTypes,
  updateChargeType,
} from "@/services";

const columns: BaseTableColumn[] = [
  { key: "code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "mgcCode", label: "MGC Code" },
  { key: "defaultTaxable", label: "Taxable by Default" },
  { key: "isActive", label: "Status" },
  { key: "actions", label: "" },
];

type Values = {
  code: string;
  name: string;
  mgcCode: string;
  defaultTaxable: boolean;
};

// The kinds of charge an invoice line can be (charge_types, design page 4).
// Never deleted, since invoice lines point to them: deactivate instead. The
// code can't change once added.
export default function ChargeTypes() {
  const queryClient = useQueryClient();
  // undefined: closed; null: adding; a charge type: editing it.
  const [editing, setEditing] = useState<ChargeType | null | undefined>(
    undefined
  );
  const paging = useServerPaging("", 20);
  const types = useQuery({
    queryKey: ["charge-types", { page: paging.page, limit: paging.limit }],
    queryFn: ({ signal }) =>
      listChargeTypes({ page: paging.page, limit: paging.limit }, signal),
    placeholderData: keepPreviousData,
  });
  const { control, handleSubmit, reset } = useForm<Values>({
    mode: "onTouched",
  });

  const refresh = (message: string) => {
    toast.success(message);
    void queryClient.invalidateQueries({ queryKey: ["charge-types"] });
  };

  const open = (type: ChargeType | null) => {
    reset({
      code: type?.code ?? "",
      name: type?.name ?? "",
      mgcCode: type?.mgcCode ?? "",
      defaultTaxable: type?.defaultTaxable ?? true,
    });
    setEditing(type);
  };

  const save = useMutation({
    mutationFn: (values: Values) => {
      const mgcCode = values.mgcCode.trim();
      return editing
        ? updateChargeType(editing.code, {
            name: values.name.trim(),
            mgcCode: mgcCode || null,
            defaultTaxable: values.defaultTaxable,
          })
        : createChargeType({
            code: values.code.trim().toUpperCase(),
            name: values.name.trim(),
            mgcCode: mgcCode || undefined,
            defaultTaxable: values.defaultTaxable,
          });
    },
    onSuccess: (type) => {
      refresh(editing ? `${type.code} updated.` : `${type.code} added.`);
      setEditing(undefined);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = useMutation({
    mutationFn: (type: ChargeType) =>
      updateChargeType(type.code, { isActive: !type.isActive }),
    onSuccess: (type) =>
      refresh(`${type.code} ${type.isActive ? "activated" : "deactivated"}.`),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="border-t-1 py-6 flex flex-col gap-4">
      <div className="flex justify-end">
        <BaseButton
          text="Add Charge Type"
          className="rounded-full px-6"
          startContent={<Add />}
          onPress={() => open(null)}
        />
      </div>
      {types.isError && (
        <AlertBanner
          message={`Couldn't load charge types: ${errorMessage(types.error)}`}
          action={
            <button
              type="button"
              className="underline text-sm"
              onClick={() => void types.refetch()}
            >
              Retry
            </button>
          }
        />
      )}
      <BaseTable<ChargeType>
        ariaLabel="Charge types"
        columns={columns}
        data={types.isError ? [] : (types.data?.items ?? [])}
        loading={types.isPending}
        rowKey={(row) => row.code}
        meta={paging.tableMeta(types.data?.meta)}
        setMeta={paging.setMeta}
        bottomContent="Charge types"
        emptyContent={
          types.isError ? "Couldn't load charge types." : "No charge types yet."
        }
        renderCell={(row, key) => {
          switch (key) {
            case "code":
              return (
                <span className="font-mono font-bold text-base-primary-300">
                  {row.code}
                </span>
              );
            case "mgcCode":
              return row.mgcCode ? (
                <span className="font-mono">{row.mgcCode}</span>
              ) : (
                <span className="text-gray-500">Not mapped</span>
              );
            case "defaultTaxable":
              return row.defaultTaxable ? "Yes" : "No";
            case "isActive":
              return row.isActive ? (
                <StatusChip text="Active" tone="success" />
              ) : (
                <StatusChip text="Inactive" tone="neutral" />
              );
            case "actions":
              return (
                <RowActions
                  actions={[
                    {
                      key: "edit",
                      label: "Edit",
                      icon: <EditSm />,
                      onPress: () => open(row),
                    },
                    {
                      key: "toggle",
                      label: row.isActive ? "Deactivate" : "Activate",
                      danger: row.isActive,
                      onPress: () => toggle.mutate(row),
                    },
                  ]}
                />
              );
            default:
              return String(row[key as keyof ChargeType] ?? "");
          }
        }}
      />
      {editing !== undefined && (
        <FormModal
          isOpen
          onOpenChange={(isOpen) => !isOpen && setEditing(undefined)}
          title={editing ? `Edit ${editing.code}` : "Add Charge Type"}
          confirmText="Save"
          isConfirming={save.isPending}
          onConfirm={handleSubmit((values) => save.mutate(values))}
        >
          <BaseInput
            name="code"
            control={control}
            label="Code"
            placeholder="TAILGATE_DELIVERY"
            isDisabled={!!editing}
            description={
              editing
                ? "The code can't be changed."
                : "Upper-case letters, digits and _."
            }
            rules={{
              required: "Enter a code",
              validate: (v) =>
                (/^[A-Za-z][A-Za-z0-9_]*$/.test(String(v).trim()) &&
                  String(v).trim().length <= 32) ||
                "Like TAILGATE_DELIVERY (up to 32)",
            }}
          />
          <BaseInput
            name="name"
            control={control}
            label="Name"
            rules={{
              required: "Enter a name",
              validate: (v) =>
                (String(v).trim().length >= 2 &&
                  String(v).trim().length <= 100) ||
                "2-100 characters",
            }}
          />
          <BaseInput
            name="mgcCode"
            control={control}
            label="MGC charge code (optional)"
            description="The matching charge code in MGC's TMS."
            rules={{ maxLength: { value: 64, message: "Up to 64 characters" } }}
          />
          <BaseSwitch name="defaultTaxable" control={control}>
            Taxable by default (each invoice line keeps its own setting)
          </BaseSwitch>
        </FormModal>
      )}
    </div>
  );
}
