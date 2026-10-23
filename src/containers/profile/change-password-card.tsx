import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { BaseButton, BaseCardWrapper, BaseInput } from "@/components/common";
import { PASSWORD_PATTERN, PASSWORD_RULE } from "@/lib/constants";
import { changePassword, errorMessage } from "@/services";

type Values = { currentPassword: string; newPassword: string; confirm: string };

const empty: Values = { currentPassword: "", newPassword: "", confirm: "" };

// Changes your own password. The API signs out your other sessions and
// sends this one a fresh token pair (services/auth.ts keeps it).
export default function ChangePasswordCard() {
  const { control, handleSubmit, reset, getValues } = useForm<Values>({
    defaultValues: empty,
  });

  const save = useMutation({
    mutationFn: ({ currentPassword, newPassword }: Values) =>
      changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      toast.success("Password changed. Your other sessions were signed out.");
      reset(empty);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <BaseCardWrapper heading="Password">
      <form
        noValidate
        className="flex flex-col gap-3 max-w-md"
        onSubmit={handleSubmit((values) => save.mutate(values))}
      >
        <BaseInput
          name="currentPassword"
          control={control}
          type="password"
          label="Current password"
          autoComplete="current-password"
          rules={{ required: "Enter your current password" }}
        />
        <BaseInput
          name="newPassword"
          control={control}
          type="password"
          label="New password"
          autoComplete="new-password"
          description={PASSWORD_RULE}
          rules={{
            required: "Enter a new password",
            validate: (value: string) => PASSWORD_PATTERN.test(value) || PASSWORD_RULE,
          }}
        />
        <BaseInput
          name="confirm"
          control={control}
          type="password"
          label="Confirm new password"
          autoComplete="new-password"
          rules={{
            required: "Enter it again",
            validate: (value: string) =>
              value === getValues("newPassword") || "The passwords don't match",
          }}
        />
        <BaseButton
          type="submit"
          text="Change Password"
          className="w-fit px-6"
          isLoading={save.isPending}
        />
      </form>
    </BaseCardWrapper>
  );
}
