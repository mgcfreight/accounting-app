import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseButton,
  BaseInput,
  BaseSelect,
  BaseTable,
  FormModal,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { Add } from "@/components/icons";
import { UserRole } from "@/lib/enums";
import { User } from "@/lib/interfaces";
import { mockUsers } from "@/lib/mock";
import { BaseTableColumn } from "@/lib/types";
import { formatDateTime, humanize } from "@/lib/utils";

const columns: BaseTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "twoFactor", label: "2FA" },
  { key: "lastLoginAt", label: "Last Sign-in" },
  { key: "actions", label: "" },
];

const roleOptions = Object.values(UserRole).map((role) => ({
  key: role,
  label: humanize(role),
  value: role,
}));

const roleHelp: Record<UserRole, string> = {
  [UserRole.Admin]: "Everything, including users, tax rates, settings and write-offs.",
  [UserRole.Accountant]: "Invoices, notes, payments, disputes, installments and statements.",
  [UserRole.Viewer]: "View and export everything; cannot change anything.",
};

// Design §9 roles. Whether 2FA is required for everyone is open question 6.
export default function UsersSection() {
  const [inviting, setInviting] = useState(false);
  const { control, handleSubmit, reset } = useForm({
    defaultValues: { name: "", email: "", role: UserRole.Accountant as string },
  });
  const role = useWatch({ control, name: "role" }) as UserRole;

  const invite = handleSubmit(() => {
    toast.success("Invitation — demo only, nothing was sent.");
    setInviting(false);
    reset();
  });

  return (
    <div className="border-t-1 py-6 flex flex-col gap-4">
      <div className="flex justify-end">
        <BaseButton
          text="Add User"
          className="rounded-full px-6"
          startContent={<Add />}
          onPress={() => setInviting(true)}
        />
      </div>
      <BaseTable<User>
        ariaLabel="Users"
        columns={columns}
        data={mockUsers}
        rowKey={(row) => row.id}
        renderCell={(row, key) => {
          switch (key) {
            case "name":
              return <PartyAvatar name={row.name} subtitle={row.email} />;
            case "role":
              return <StatusChip text={humanize(row.role)} tone={row.role === UserRole.Admin ? "secondary" : "primary"} />;
            case "twoFactor":
              return row.twoFactor ? (
                <StatusChip text="On" tone="success" />
              ) : (
                <StatusChip text="Off" tone="warning" />
              );
            case "lastLoginAt":
              return formatDateTime(row.lastLoginAt) ?? "Never";
            case "actions":
              return (
                <RowActions
                  actions={[
                    { key: "role", label: "Change role", onPress: () => toast.info("Change role — demo only.") },
                    { key: "reset-2fa", label: "Reset 2FA", onPress: () => toast.info("Reset 2FA — demo only.") },
                    { key: "deactivate", label: "Deactivate", danger: true, onPress: () => toast.info("Deactivate — demo only.") },
                  ]}
                />
              );
            default:
              return null;
          }
        }}
      />
      <FormModal
        isOpen={inviting}
        onOpenChange={setInviting}
        title="Add User"
        confirmText="Send Invitation"
        onConfirm={invite}
      >
        <BaseInput name="name" control={control} label="Full name" rules={{ required: "Enter a name" }} />
        <BaseInput
          name="email"
          control={control}
          type="email"
          label="Email"
          rules={{
            required: "Enter an email",
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email" },
          }}
        />
        <BaseSelect
          name="role"
          control={control}
          label="Role"
          options={roleOptions}
          disallowEmptySelection
          description={roleHelp[role]}
        />
      </FormModal>
    </div>
  );
}
