import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { BaseInput, BaseSelect, FormModal } from "@/components/common";
import {
  EMAIL_PATTERN,
  PASSWORD_PATTERN,
  PASSWORD_RULE,
  PERSON_NAME_PATTERN,
} from "@/lib/constants";
import { UserRole } from "@/lib/enums";
import { User } from "@/lib/interfaces";
import { fullName, humanize } from "@/lib/utils";
import { createUser, errorMessage, setUserPassword, updateUser } from "@/services";

// The Users & Roles modals. Each is mounted only while open, so its form
// starts fresh every time. After a change the user list is refetched.

const roleOptions = Object.values(UserRole).map((role) => ({
  key: role,
  label: humanize(role),
  value: role,
}));

const roleHelp: Record<UserRole, string> = {
  [UserRole.Admin]: "Everything, including users, tax rates, settings and write-offs. Must use 2FA.",
  [UserRole.Accountant]: "Invoices, notes, payments, disputes, installments and statements.",
  [UserRole.Viewer]: "View and export everything; cannot change anything.",
};

const nameRules = (what: string) => ({
  required: `Enter a ${what}`,
  minLength: { value: 2, message: "At least 2 characters" },
  maxLength: { value: 50, message: "At most 50 characters" },
  validate: (value: string) =>
    PERSON_NAME_PATTERN.test(value.trim()) ||
    "Letters, spaces, apostrophes, hyphens and periods only",
});

const passwordRules = {
  required: "Enter a password",
  validate: (value: string) => PASSWORD_PATTERN.test(value) || PASSWORD_RULE,
};

interface UserFormValues {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  password: string;
}

// Adds a user, or edits one's name and role. The API refuses a change to
// your own role, so the field is locked for yourself.
export function UserFormModal({
  user,
  isSelf = false,
  onSaved,
  onClose,
}: {
  // Omitted to add a new user.
  user?: User;
  isSelf?: boolean;
  onSaved?: (user: User) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { control, handleSubmit } = useForm<UserFormValues>({
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      email: "",
      role: user?.role ?? UserRole.Accountant,
      password: "",
    },
  });
  const role = useWatch({ control, name: "role" }) as UserRole;

  const save = useMutation({
    mutationFn: (values: UserFormValues) => {
      const names = {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
      };
      if (user) {
        return updateUser(user.id, {
          ...names,
          ...(!isSelf && { role: values.role as UserRole }),
        });
      }
      return createUser({
        ...names,
        email: values.email.trim(),
        role: values.role as UserRole,
        password: values.password,
      });
    },
    onSuccess: (saved) => {
      toast.success(user ? "User updated." : `${fullName(saved)} was added.`);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={user ? `Edit ${fullName(user)}` : "Add User"}
      confirmText={user ? "Save" : "Add User"}
      isConfirming={save.isPending}
      onConfirm={handleSubmit((values) => save.mutate(values))}
    >
      <BaseInput name="firstName" control={control} label="First name" rules={nameRules("first name")} />
      <BaseInput name="lastName" control={control} label="Last name" rules={nameRules("last name")} />
      {user ? null : (
        <BaseInput
          name="email"
          control={control}
          type="email"
          label="Email"
          description="They sign in with this. It can't be changed later."
          rules={{
            required: "Enter an email",
            maxLength: { value: 254, message: "At most 254 characters" },
            validate: (value: string) =>
              EMAIL_PATTERN.test(value.trim()) || "Enter a valid email",
          }}
        />
      )}
      <BaseSelect
        name="role"
        control={control}
        label="Role"
        options={roleOptions}
        disallowEmptySelection
        isDisabled={isSelf}
        description={isSelf ? "You can't change your own role." : roleHelp[role]}
      />
      {user ? null : (
        <BaseInput
          name="password"
          control={control}
          type="password"
          label="Temporary password"
          autoComplete="new-password"
          description={`${PASSWORD_RULE} Give it to them yourself; nothing is emailed.`}
          rules={passwordRules}
        />
      )}
    </FormModal>
  );
}

// Sets a user's password. Signs them out and clears a lockout; 2FA stays.
export function SetPasswordModal({
  user,
  onClose,
}: {
  user: User;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm({
    defaultValues: { password: "" },
  });

  const save = useMutation({
    mutationFn: ({ password }: { password: string }) =>
      setUserPassword(user.id, password),
    onSuccess: () => {
      toast.success(`Password set. ${fullName(user)} was signed out.`);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={`Set Password for ${fullName(user)}`}
      confirmText="Set Password"
      isConfirming={save.isPending}
      onConfirm={handleSubmit((values) => save.mutate(values))}
    >
      <p className="text-sm">
        This signs them out everywhere and clears a lockout. Their 2FA is
        unchanged — if they also lost their authenticator, reset 2FA too.
      </p>
      <BaseInput
        name="password"
        control={control}
        type="password"
        label="New password"
        autoComplete="new-password"
        description={PASSWORD_RULE}
        rules={passwordRules}
      />
    </FormModal>
  );
}

// A yes/no confirmation for a user action (reset 2FA, enable, disable).
export function ConfirmUserActionModal({
  title,
  message,
  confirmText,
  successMessage,
  action,
  onClose,
}: {
  title: string;
  message: string;
  confirmText: string;
  successMessage: string;
  action: () => Promise<void>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const confirm = useMutation({
    mutationFn: action,
    onSuccess: () => {
      toast.success(successMessage);
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title={title}
      confirmText={confirmText}
      isConfirming={confirm.isPending}
      onConfirm={() => confirm.mutate()}
    >
      <p className="text-sm">{message}</p>
    </FormModal>
  );
}
