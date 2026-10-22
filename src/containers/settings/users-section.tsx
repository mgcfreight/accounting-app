import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  BaseButton,
  BaseTable,
  ErrorState,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import type { RowAction } from "@/components/common/row-actions";
import { Add } from "@/components/icons";
import { useCurrentUser, useUser } from "@/components/providers/user-provider";
import { PAGE_SIZES } from "@/lib/constants";
import { UserRole } from "@/lib/enums";
import { User } from "@/lib/interfaces";
import { BaseTableColumn, PaginationMeta } from "@/lib/types";
import { formatDateTime, fullName, humanize } from "@/lib/utils";
import { getUsers, resetUserTwoFactor, setUserEnabled } from "@/services";
import {
  ConfirmUserActionModal,
  SetPasswordModal,
  UserFormModal,
} from "./user-modals";

const columns: BaseTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "twoFactor", label: "2FA" },
  { key: "status", label: "Status" },
  { key: "lastLoginAt", label: "Last Sign-in" },
  { key: "actions", label: "" },
];

type OpenModal =
  | { kind: "add" }
  | { kind: "edit"; user: User }
  | { kind: "password"; user: User }
  | { kind: "reset-2fa"; user: User }
  | { kind: "set-enabled"; user: User };

// Design §9 roles, from the API's /user routes (Admin only). Paged on the
// server: `paging` is what to ask for, the response's meta is what's shown.
export default function UsersSection() {
  const currentUser = useCurrentUser();
  const { setUser } = useUser();
  const [modal, setModal] = useState<OpenModal | null>(null);
  const [paging, setPaging] = useState<PaginationMeta>({
    currentPage: 1,
    itemsPerPage: PAGE_SIZES[0],
    itemCount: 0,
    totalItems: 0,
    totalPages: 0,
  });
  const page = paging.currentPage;
  const limit = paging.itemsPerPage;

  const users = useQuery({
    queryKey: ["users", { page, limit }],
    queryFn: ({ signal }) => getUsers({ page, limit }, signal),
    placeholderData: keepPreviousData,
  });

  const close = () => setModal(null);

  // The API refuses these on your own account, so they aren't offered.
  const actionsFor = (row: User): RowAction[] => {
    const isSelf = row.id === currentUser.id;
    return [
      { key: "edit", label: "Edit name or role", onPress: () => setModal({ kind: "edit", user: row }) },
      { key: "password", label: "Set password", onPress: () => setModal({ kind: "password", user: row }) },
      ...(!isSelf && row.twoFactorEnabled
        ? [{ key: "reset-2fa", label: "Reset 2FA", onPress: () => setModal({ kind: "reset-2fa", user: row }) }]
        : []),
      ...(!isSelf
        ? [{
            key: "set-enabled",
            label: row.isEnabled ? "Disable" : "Enable",
            danger: row.isEnabled,
            onPress: () => setModal({ kind: "set-enabled", user: row }),
          }]
        : []),
    ];
  };

  return (
    <div className="border-t-1 py-6 flex flex-col gap-4">
      <div className="flex justify-end">
        <BaseButton
          text="Add User"
          className="rounded-full px-6"
          startContent={<Add />}
          onPress={() => setModal({ kind: "add" })}
        />
      </div>
      {users.isError ? (
        <ErrorState
          message="We couldn't load the users. Please try again."
          onAction={() => void users.refetch()}
        />
      ) : (
        <BaseTable<User>
          ariaLabel="Users"
          columns={columns}
          data={users.data?.items ?? []}
          loading={users.isPending}
          meta={users.data?.meta ?? paging}
          setMeta={setPaging}
          bottomContent="Users"
          rowKey={(row) => row.id}
          renderCell={(row, key) => {
            switch (key) {
              case "name":
                return <PartyAvatar name={fullName(row)} subtitle={row.email} />;
              case "role":
                return <StatusChip text={humanize(row.role)} tone={row.role === UserRole.Admin ? "secondary" : "primary"} />;
              case "twoFactor":
                return row.twoFactorEnabled ? (
                  <StatusChip text="On" tone="success" />
                ) : (
                  <StatusChip text="Off" tone="warning" />
                );
              case "status":
                return row.isEnabled ? (
                  <StatusChip text="Enabled" tone="success" />
                ) : (
                  <StatusChip text="Disabled" tone="neutral" />
                );
              case "lastLoginAt":
                return formatDateTime(row.lastLoginAt ?? undefined) ?? "Never";
              case "actions":
                return <RowActions actions={actionsFor(row)} />;
              default:
                return null;
            }
          }}
        />
      )}

      {modal?.kind === "add" ? <UserFormModal onClose={close} /> : null}
      {modal?.kind === "edit" ? (
        <UserFormModal
          user={modal.user}
          isSelf={modal.user.id === currentUser.id}
          // Your own new name shows in the header straight away.
          onSaved={(saved) => saved.id === currentUser.id && setUser(saved)}
          onClose={close}
        />
      ) : null}
      {modal?.kind === "password" ? (
        <SetPasswordModal user={modal.user} onClose={close} />
      ) : null}
      {modal?.kind === "reset-2fa" ? (
        <ConfirmUserActionModal
          title={`Reset 2FA for ${fullName(modal.user)}?`}
          message="This removes their authenticator app and recovery codes and signs them out. They set 2FA up again at their next sign-in."
          confirmText="Reset 2FA"
          successMessage="2FA reset."
          action={() => resetUserTwoFactor(modal.user.id)}
          onClose={close}
        />
      ) : null}
      {modal?.kind === "set-enabled" ? (
        <ConfirmUserActionModal
          title={`${modal.user.isEnabled ? "Disable" : "Enable"} ${fullName(modal.user)}?`}
          message={
            modal.user.isEnabled
              ? "They're signed out everywhere and can't sign in until enabled again."
              : "They can sign in again with their current password."
          }
          confirmText={modal.user.isEnabled ? "Disable" : "Enable"}
          successMessage={modal.user.isEnabled ? "User disabled." : "User enabled."}
          action={() => setUserEnabled(modal.user.id, !modal.user.isEnabled)}
          onClose={close}
        />
      ) : null}
    </div>
  );
}
