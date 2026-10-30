import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseInput,
  BaseTextArea,
  FormModal,
  TableSkeleton,
} from "@/components/common";
import { Permission } from "@/lib/enums";
import { PermissionCatalog, Role } from "@/lib/interfaces";
import {
  createRole,
  errorMessage,
  getPermissionCatalog,
  RoleChanges,
  updateRole,
} from "@/services";
import PermissionMatrix from "./permission-matrix";

// The API's rule for a role name: 2-50 characters, starting with a letter or
// digit, then letters, digits, spaces and & ' ( ) . / -
const ROLE_NAME_SHAPE = /^[\p{L}\p{N}][\p{L}\p{N} &'()./-]*$/u;

type Values = { name: string; description: string };

// In catalog order, so what's sent matches what the API returns.
const inCatalogOrder = (catalog: PermissionCatalog, set: Set<Permission>) =>
  catalog.modules.flatMap((row) =>
    row.actions.map((cell) => cell.permission).filter((p) => set.has(p))
  );

const sameSet = (a: Set<Permission>, b: Set<Permission>) =>
  a.size === b.size && [...a].every((p) => b.has(p));

// Add a role, or change one. The Admin role is read-only (it always has every
// permission, plus users, roles and settings); the other built-in roles keep
// their names. Changing a role's permissions signs out everyone on it.
export default function RoleFormModal({
  role,
  existingNames,
  onClose,
}: {
  // Null adds a new role.
  role: Role | null;
  // Every other role's name, lower-cased, to catch a duplicate before saving.
  existingNames: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const catalog = useQuery({
    queryKey: ["role-permissions"],
    queryFn: ({ signal }) => getPermissionCatalog(signal),
    staleTime: Infinity,
  });
  const [selected, setSelected] = useState<Set<Permission>>(
    () => new Set(role?.permissions ?? [])
  );
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const { control, handleSubmit } = useForm<Values>({
    mode: "onTouched",
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
    },
  });

  const isLocked = !!role && !role.permissionsEditable;
  const nameLocked = !!role?.isSystem;

  // Only the fields that changed; null clears a description.
  const changesFrom = (values: Values): RoleChanges => {
    const changes: RoleChanges = {};
    const name = values.name.trim();
    const description = values.description.trim();
    if (role && !nameLocked && name !== role.name) changes.name = name;
    if (role && description !== (role.description ?? "")) {
      changes.description = description || null;
    }
    // The whole set is replaced, so permissions this build can't show go back
    // unchanged rather than being removed.
    if (catalog.data && !sameSet(selected, new Set(role?.permissions ?? []))) {
      changes.permissions = [
        ...inCatalogOrder(catalog.data, selected),
        ...(role?.unknownPermissions ?? []),
      ];
    }
    return changes;
  };

  const save = useMutation({
    mutationFn: (values: Values) => {
      if (!role) {
        const description = values.description.trim();
        return createRole({
          name: values.name.trim(),
          ...(description ? { description } : {}),
          permissions: inCatalogOrder(catalog.data!, selected),
        });
      }
      return updateRole(role.id, changesFrom(values));
    },
    onSuccess: (saved) => {
      toast.success(role ? `${saved.name} updated.` : `${saved.name} added.`);
      // User rows show role names, so refresh those too.
      void queryClient.invalidateQueries({ queryKey: ["roles"] });
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (error) => {
      setConfirmSignOut(false);
      toast.error(errorMessage(error));
    },
  });

  const submit = handleSubmit((values) => {
    // Without the catalog the matrix isn't shown, so nothing chosen is known.
    if (!catalog.data) {
      toast.error("The permission list hasn't loaded yet.");
      return;
    }
    if (!role) return save.mutate(values);
    const changes = changesFrom(values);
    if (Object.keys(changes).length === 0) {
      toast.info("Nothing changed.");
      return onClose();
    }
    if (changes.permissions && role.userCount > 0 && !confirmSignOut) {
      setConfirmSignOut(true);
      return;
    }
    save.mutate(values);
  });

  if (confirmSignOut && role) {
    const users = role.userCount === 1 ? "1 user" : `${role.userCount} users`;
    return (
      <FormModal
        isOpen
        onOpenChange={(open) => !open && setConfirmSignOut(false)}
        title="Change permissions?"
        confirmText="Save and sign out"
        isConfirming={save.isPending}
        onConfirm={submit}
      >
        <p className="text-sm">
          {users} on {role.name} will be signed out, and sign in again with the
          new permissions.
        </p>
      </FormModal>
    );
  }

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={role ? (isLocked ? role.name : `Edit ${role.name}`) : "Add Role"}
      confirmText={isLocked ? "Close" : role ? "Save" : "Add Role"}
      isConfirming={save.isPending}
      onConfirm={isLocked ? onClose : submit}
      size="5xl"
    >
      {isLocked && (
        <AlertBanner message="The Admin role always has every permission, plus users, roles and settings. It can't be changed." />
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BaseInput
          name="name"
          control={control}
          label="Name"
          isDisabled={nameLocked}
          description={
            nameLocked ? "A built-in role keeps its name." : undefined
          }
          rules={{
            validate: (value: string) => {
              if (nameLocked) return true;
              const name = value.trim();
              if (name.length < 2 || name.length > 50) return "2-50 characters";
              if (!ROLE_NAME_SHAPE.test(name)) {
                return "Letters, digits, spaces and & ' ( ) . / - only, starting with a letter or digit";
              }
              return (
                !existingNames.includes(name.toLowerCase()) ||
                "A role with this name already exists"
              );
            },
          }}
        />
        <BaseTextArea
          name="description"
          control={control}
          label="Description (optional)"
          minRows={1}
          isDisabled={isLocked}
          rules={{
            validate: (value: string) =>
              value.trim().length <= 255 || "Up to 255 characters",
          }}
        />
      </div>
      {catalog.isError ? (
        <AlertBanner
          message={`Couldn't load the permission list: ${errorMessage(catalog.error)}`}
          action={
            <button
              type="button"
              className="underline text-sm"
              onClick={() => void catalog.refetch()}
            >
              Retry
            </button>
          }
        />
      ) : catalog.data ? (
        <PermissionMatrix
          catalog={catalog.data}
          selected={selected}
          onChange={setSelected}
          isReadOnly={isLocked}
        />
      ) : (
        <TableSkeleton />
      )}
      {role && role.unknownPermissions.length > 0 && !isLocked && (
        <p className="text-xs text-content-5">
          {`This role also has ${role.unknownPermissions.length === 1 ? "1 permission" : `${role.unknownPermissions.length} permissions`} this version of the app can't show. Saving keeps them.`}
        </p>
      )}
      {role && role.userCount > 0 && !isLocked && (
        <p className="text-xs text-content-5">
          Changing permissions signs out everyone on this role.
        </p>
      )}
    </FormModal>
  );
}
