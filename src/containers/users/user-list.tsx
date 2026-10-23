import { Card } from "@heroui/react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseInput,
  BaseSelect,
  BaseTable,
  FilterBar,
  FormModal,
  PartyAvatar,
  RowActions,
  StatusChip,
} from "@/components/common";
import { SearchNormalSm } from "@/components/icons";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import { useCurrentUser } from "@/components/providers/user-provider";
import { useDebouncedValue, useServerPaging } from "@/hooks";
import { PASSWORD_RULE, PASSWORD_RULE_TEXT } from "@/lib/constants";
import { SystemRoleId } from "@/lib/enums";
import { User } from "@/lib/interfaces";
import { BaseTableColumn, TableSort } from "@/lib/types";
import { formatDateTime, fullName } from "@/lib/utils";
import {
  ALL_ROLES_PARAMS,
  errorMessage,
  listRoles,
  listUsers,
  resetUserTwoFactor,
  setUserEnabled,
  setUserPassword,
  UserSortBy,
} from "@/services";
import UserFormModal from "./user-form-modal";

type Filters = { search: string; role: string; status: string };

const columns: BaseTableColumn[] = [
  { key: "name", label: "Name", sortable: true },
  { key: "role", label: "Role", sortable: true },
  { key: "status", label: "Status" },
  { key: "twoFactor", label: "2FA" },
  { key: "lastLoginAt", label: "Last Sign-in", sortable: true },
  { key: "createdAt", label: "Added", sortable: true },
  { key: "actions", label: "" },
];

const ALL = "ALL";
const statusFilter = [
  { key: ALL, label: "All statuses", value: ALL },
  { key: "true", label: "Enabled", value: "true" },
  { key: "false", label: "Disabled", value: "false" },
];

// A confirmation for the row actions that sign someone out or change their
// sign-in; the password one also takes the new password.
type Pending =
  | { kind: "enable" | "disable" | "reset-2fa"; user: User }
  | { kind: "password"; user: User };

// Staff accounts (Admin only: routes.config, and the API refuses others).
// Users are never deleted; disable them instead.
export default function UserList() {
  const me = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<User | null | undefined>(undefined);
  const [pending, setPending] = useState<Pending | null>(null);
  const [sort, setSort] = useState<TableSort | null>(null);
  const { control } = useForm<Filters>({
    defaultValues: { search: "", role: ALL, status: ALL },
  });
  const search = useDebouncedValue(
    useWatch({ control, name: "search" }).trim()
  );
  const role = useWatch({ control, name: "role" });
  const status = useWatch({ control, name: "status" });
  const paging = useServerPaging(JSON.stringify([search, role, status, sort]));

  useHeaderAction("add-user", () => setEditing(null));

  // Roles are configurable, so the filter lists them from the API.
  const roles = useQuery({
    queryKey: ["roles", ALL_ROLES_PARAMS],
    queryFn: ({ signal }) => listRoles(ALL_ROLES_PARAMS, signal),
  });
  const roleFilter = [
    { key: ALL, label: "All roles", value: ALL },
    ...(roles.data?.items ?? []).map((item) => ({
      key: item.id,
      label: item.name,
      value: item.id,
    })),
  ];

  const params = {
    page: paging.page,
    limit: paging.limit,
    searchQuery: search,
    roleId: role && role !== ALL ? role : undefined,
    isEnabled: status && status !== ALL ? status === "true" : undefined,
    sortBy: sort?.sortKey as UserSortBy | undefined,
    order: sort?.direction === "desc" ? ("DESC" as const) : ("ASC" as const),
  };
  const users = useQuery({
    queryKey: ["users", params],
    queryFn: ({ signal }) => listUsers(params, signal),
    placeholderData: keepPreviousData,
  });

  const done = (message: string) => {
    toast.success(message);
    setPending(null);
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  };
  const act = useMutation({
    mutationFn: ({
      pending,
      password,
    }: {
      pending: Pending;
      password?: string;
    }) => {
      switch (pending.kind) {
        case "enable":
          return setUserEnabled(pending.user.id, true);
        case "disable":
          return setUserEnabled(pending.user.id, false);
        case "reset-2fa":
          return resetUserTwoFactor(pending.user.id);
        case "password":
          return setUserPassword(pending.user.id, password ?? "");
      }
    },
    onSuccess: done,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const passwordForm = useForm<{ password: string }>({ mode: "onTouched" });

  const renderCell = (row: User, key: string) => {
    const isMe = row.id === me.id;
    switch (key) {
      case "name":
        return <PartyAvatar name={fullName(row)} subtitle={row.email} />;
      case "role":
        return (
          <StatusChip
            text={row.role.name}
            tone={row.role.id === SystemRoleId.Admin ? "secondary" : "primary"}
          />
        );
      case "status":
        return row.isEnabled ? (
          <StatusChip text="Enabled" tone="success" />
        ) : (
          <StatusChip text="Disabled" tone="neutral" />
        );
      case "twoFactor":
        return row.twoFactorEnabled ? (
          <StatusChip text="On" tone="success" />
        ) : (
          <StatusChip text="Off" tone="warning" />
        );
      case "lastLoginAt":
        return (
          <span className="whitespace-nowrap">
            {formatDateTime(row.lastLoginAt ?? undefined) ?? "Never"}
          </span>
        );
      case "createdAt":
        return (
          <span className="whitespace-nowrap">
            {formatDateTime(row.createdAt)}
          </span>
        );
      case "actions":
        return (
          <RowActions
            actions={[
              {
                key: "edit",
                label: "Edit name and role",
                onPress: () => setEditing(row),
              },
              {
                key: "sessions",
                label: "View sessions",
                onPress: () =>
                  navigate(
                    `/users/sessions/?userId=${encodeURIComponent(row.id)}`
                  ),
              },
              {
                key: "password",
                label: "Set password",
                onPress: () => {
                  passwordForm.reset({ password: "" });
                  setPending({ kind: "password", user: row });
                },
              },
              // The API refuses these on your own account; don't offer them.
              ...(isMe
                ? []
                : [
                    {
                      key: "reset-2fa",
                      label: "Reset 2FA",
                      onPress: () =>
                        setPending({ kind: "reset-2fa", user: row }),
                    },
                    row.isEnabled
                      ? {
                          key: "disable",
                          label: "Disable",
                          danger: true,
                          onPress: () =>
                            setPending({ kind: "disable", user: row }),
                        }
                      : {
                          key: "enable",
                          label: "Enable",
                          onPress: () =>
                            setPending({ kind: "enable", user: row }),
                        },
                  ]),
            ]}
          />
        );
      default:
        return null;
    }
  };

  const confirmText: Record<Pending["kind"], string> = {
    enable: "Enable",
    disable: "Disable",
    "reset-2fa": "Reset 2FA",
    password: "Set Password",
  };
  const explain = (p: Pending) => {
    const name = fullName(p.user);
    switch (p.kind) {
      case "enable":
        return `${name} will be able to sign in again. This also clears a lockout.`;
      case "disable":
        return `${name} will be signed out and can't sign in until enabled again.`;
      case "reset-2fa":
        return `${name}'s two-factor sign-in is removed. They set it up again the next time they sign in.`;
      case "password":
        return `${name} is signed out and signs in with this password. It also clears a lockout; their two-factor sign-in is unchanged.`;
    }
  };

  return (
    <>
      <FilterBar>
        <BaseInput
          name="search"
          control={control}
          className="max-w-sm"
          classNames={{
            inputWrapper: "bg-[#FFFFFF66] h-12 border-1 rounded-lg",
          }}
          placeholder="Search by name or email"
          aria-label="Search users"
          endContent={<SearchNormalSm />}
        />
        <BaseSelect
          name="role"
          control={control}
          options={roleFilter}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Role"
          disallowEmptySelection
        />
        <BaseSelect
          name="status"
          control={control}
          options={statusFilter}
          className="w-full sm:w-44"
          classNames={{ trigger: "bg-white border-none h-12 rounded-lg" }}
          aria-label="Status"
          disallowEmptySelection
        />
      </FilterBar>
      {users.isError && (
        <AlertBanner
          message={`Couldn't load users: ${errorMessage(users.error)}`}
          action={
            <button
              type="button"
              className="underline text-sm"
              onClick={() => void users.refetch()}
            >
              Retry
            </button>
          }
        />
      )}
      <Card className="mt-4">
        <BaseTable<User>
          ariaLabel="Users"
          columns={columns}
          data={users.isError ? [] : (users.data?.items ?? [])}
          loading={users.isPending}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          meta={paging.tableMeta(users.data?.meta)}
          setMeta={paging.setMeta}
          sort={sort}
          onSortChange={setSort}
          bottomContent="Users"
          emptyContent={
            users.isError ? "Couldn't load users." : "No users match."
          }
        />
      </Card>

      {editing !== undefined && (
        <UserFormModal user={editing} onClose={() => setEditing(undefined)} />
      )}

      {pending && (
        <FormModal
          isOpen
          onOpenChange={(open) => !open && setPending(null)}
          title={`${confirmText[pending.kind]}: ${fullName(pending.user)}`}
          confirmText={confirmText[pending.kind]}
          isConfirming={act.isPending}
          onConfirm={
            pending.kind === "password"
              ? passwordForm.handleSubmit(({ password }) =>
                  act.mutate({ pending, password })
                )
              : () => act.mutate({ pending })
          }
        >
          <p className="text-sm">{explain(pending)}</p>
          {pending.kind === "password" && (
            <BaseInput
              name="password"
              control={passwordForm.control}
              type="password"
              autoComplete="new-password"
              label="New password"
              description={PASSWORD_RULE_TEXT}
              rules={{
                required: "Enter a password",
                validate: (value) =>
                  PASSWORD_RULE.test(value) || PASSWORD_RULE_TEXT,
              }}
            />
          )}
        </FormModal>
      )}
    </>
  );
}
