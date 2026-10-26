import { Card } from "@heroui/react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseTable,
  FormModal,
  RowActions,
  StatusChip,
} from "@/components/common";
import { EditSm } from "@/components/icons";
import { useHeaderAction } from "@/components/providers/header-action-provider";
import { useServerPaging } from "@/hooks";
import { Role } from "@/lib/interfaces";
import { BaseTableColumn } from "@/lib/types";
import {
  ALL_ROLES_PARAMS,
  deleteRole,
  errorMessage,
  listRoles,
} from "@/services";
import RoleFormModal from "./role-form-modal";

const columns: BaseTableColumn[] = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "userCount", label: "Users" },
  { key: "permissions", label: "Permissions" },
  { key: "actions", label: "" },
];

// Staff roles and what each may do (Admin only: routes.config, and the API
// refuses others). Built-in roles come first; the API keeps them locked.
export default function RoleList() {
  const queryClient = useQueryClient();
  // undefined: closed; null: adding; a role: editing it.
  const [editing, setEditing] = useState<Role | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const paging = useServerPaging("", 20);

  useHeaderAction("add-role", () => setEditing(null));

  const params = { page: paging.page, limit: paging.limit };
  const roles = useQuery({
    queryKey: ["roles", params],
    queryFn: ({ signal }) => listRoles(params, signal),
    placeholderData: keepPreviousData,
  });
  // Every name, for the editor's duplicate check (one page may not hold them).
  const allRoles = useQuery({
    queryKey: ["roles", ALL_ROLES_PARAMS],
    queryFn: ({ signal }) => listRoles(ALL_ROLES_PARAMS, signal),
  });
  const otherNames = (role: Role | null) =>
    (allRoles.data?.items ?? [])
      .filter((item) => item.id !== role?.id)
      .map((item) => item.name.toLowerCase());

  const remove = useMutation({
    mutationFn: (role: Role) => deleteRole(role.id),
    onSuccess: (_message, role) => {
      toast.success(`${role.name} deleted.`);
      setDeleting(null);
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const renderCell = (row: Role, key: string) => {
    switch (key) {
      case "name":
        return (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base-primary-900">
              {row.name}
            </span>
            {row.isSystem && <StatusChip text="Built-in" tone="neutral" />}
          </div>
        );
      case "description":
        return row.description ?? <span className="text-gray-400">—</span>;
      case "userCount":
        return row.userCount;
      case "permissions":
        return row.isAdmin ? "All" : row.permissions.length;
      case "actions": {
        const blocked = row.isSystem
          ? "A built-in role can't be deleted"
          : row.userCount > 0
            ? "Move its users to another role first"
            : undefined;
        return (
          <RowActions
            actions={[
              {
                key: "edit",
                label: row.isAdmin ? "View" : "Edit",
                icon: <EditSm />,
                onPress: () => setEditing(row),
              },
              {
                key: "delete",
                label: "Delete",
                danger: !blocked,
                disabled: !!blocked,
                hint: blocked,
                onPress: () => setDeleting(row),
              },
            ]}
          />
        );
      }
      default:
        return null;
    }
  };

  return (
    <>
      {roles.isError && (
        <AlertBanner
          message={`Couldn't load roles: ${errorMessage(roles.error)}`}
          action={
            <button
              type="button"
              className="underline text-sm"
              onClick={() => void roles.refetch()}
            >
              Retry
            </button>
          }
        />
      )}
      <Card className="mt-4">
        <BaseTable<Role>
          ariaLabel="Roles"
          columns={columns}
          data={roles.isError ? [] : (roles.data?.items ?? [])}
          loading={roles.isPending}
          rowKey={(row) => row.id}
          renderCell={renderCell}
          meta={paging.tableMeta(roles.data?.meta)}
          setMeta={paging.setMeta}
          bottomContent="Roles"
          emptyContent={roles.isError ? "Couldn't load roles." : "No roles yet."}
        />
      </Card>

      {editing !== undefined && (
        <RoleFormModal
          role={editing}
          existingNames={otherNames(editing)}
          onClose={() => setEditing(undefined)}
        />
      )}

      {deleting && (
        <FormModal
          isOpen
          onOpenChange={(open) => !open && setDeleting(null)}
          title={`Delete ${deleting.name}?`}
          confirmText="Delete"
          isConfirming={remove.isPending}
          onConfirm={() => remove.mutate(deleting)}
        >
          <p className="text-sm">
            The role and its permissions are removed. This can&apos;t be undone.
          </p>
        </FormModal>
      )}
    </>
  );
}
