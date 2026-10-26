import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { BaseInput, BaseSelect, FormModal } from "@/components/common";
import { useCurrentUser } from "@/components/providers/user-provider";
import {
  EMAIL_SHAPE,
  PASSWORD_RULE,
  PASSWORD_RULE_TEXT,
} from "@/lib/constants";
import { SystemRoleId } from "@/lib/enums";
import { User } from "@/lib/interfaces";
import {
  ALL_ROLES_PARAMS,
  createUser,
  errorMessage,
  listRoles,
  updateUser,
} from "@/services";

// The API's rule for first and last names.
const NAME_SHAPE = /^\p{L}[\p{L} '.-]*$/u;
const nameRules = (label: string) => ({
  required: `Enter a ${label}`,
  validate: (value: string) => {
    const name = value.trim();
    if (name.length < 2 || name.length > 50) return "2-50 characters";
    return (
      NAME_SHAPE.test(name) ||
      "Letters, spaces, apostrophes, dots and hyphens only"
    );
  },
});

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  roleId: string;
  password: string;
};

// Add a user (with a starting password they change after signing in), or
// edit one's name and role. Email can't be changed. Changing a role signs
// that user out.
export default function UserFormModal({
  user,
  onClose,
}: {
  // Null adds a new user.
  user: User | null;
  onClose: () => void;
}) {
  const me = useCurrentUser();
  const queryClient = useQueryClient();
  // The API refuses a change to your own role.
  const isMe = user?.id === me.id;
  const roles = useQuery({
    queryKey: ["roles", ALL_ROLES_PARAMS],
    queryFn: ({ signal }) => listRoles(ALL_ROLES_PARAMS, signal),
  });
  const roleOptions = (roles.data?.items ?? []).map((role) => ({
    key: role.id,
    label: role.name,
    value: role.id,
  }));
  const { control, handleSubmit } = useForm<Values>({
    mode: "onTouched",
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: user?.email ?? "",
      roleId: user?.role.id ?? SystemRoleId.Accountant,
      password: "",
    },
  });
  const roleId = useWatch({ control, name: "roleId" });
  const roleHelp =
    roles.data?.items.find((role) => role.id === roleId)?.description ??
    undefined;
  const roleChanged = !!user && roleId !== user.role.id;

  const save = useMutation({
    mutationFn: (values: Values) => {
      const names = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
      };
      return user
        ? updateUser(user.id, {
            ...names,
            ...(roleChanged && !isMe ? { roleId: values.roleId } : {}),
          })
        : createUser({
            ...names,
            roleId: values.roleId,
            email: values.email.trim(),
            password: values.password,
          });
    },
    onSuccess: () => {
      toast.success(user ? "User updated." : "User added.");
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={user ? "Edit User" : "Add User"}
      confirmText={user ? "Save" : "Add User"}
      isConfirming={save.isPending}
      onConfirm={handleSubmit((values) => save.mutate(values))}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BaseInput
          name="firstName"
          control={control}
          label="First name"
          rules={nameRules("first name")}
        />
        <BaseInput
          name="lastName"
          control={control}
          label="Last name"
          rules={nameRules("last name")}
        />
      </div>
      <BaseInput
        name="email"
        control={control}
        type="email"
        label="Email"
        isDisabled={!!user}
        description={user ? "Email can't be changed." : undefined}
        rules={{
          required: "Enter an email",
          validate: (value) =>
            EMAIL_SHAPE.test(value.trim()) || "Enter a valid email",
        }}
      />
      <BaseSelect
        name="roleId"
        control={control}
        label="Role"
        options={roleOptions}
        disallowEmptySelection
        isDisabled={isMe || roles.isPending || roles.isError}
        rules={{ required: "Choose a role" }}
        description={
          roles.isError
            ? `Couldn't load roles: ${errorMessage(roles.error)}`
            : isMe
              ? "You can't change your own role."
              : roleChanged
                ? [roleHelp, `Changing the role signs ${user.firstName} out.`]
                    .filter(Boolean)
                    .join(" ")
                : roleHelp
        }
      />
      {!user && (
        <BaseInput
          name="password"
          control={control}
          type="password"
          autoComplete="new-password"
          label="Starting password"
          description={`Share it with the user privately. ${PASSWORD_RULE_TEXT}`}
          rules={{
            required: "Enter a starting password",
            validate: (value) =>
              PASSWORD_RULE.test(value) || PASSWORD_RULE_TEXT,
          }}
        />
      )}
    </FormModal>
  );
}
