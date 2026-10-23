import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { BaseButton, BaseCardWrapper, BaseInput } from "@/components/common";
import { PASSWORD_RULE, PASSWORD_RULE_TEXT } from "@/lib/constants";
import { changePassword, errorMessage } from "@/services";

type Values = { currentPassword: string; newPassword: string; confirm: string };

// The API replaces this browser's session cookies and signs out every other
// device.
export default function ChangePassword() {
  const { control, handleSubmit, reset, getValues } = useForm<Values>({
    mode: "onTouched",
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });

  const change = useMutation({
    mutationFn: (values: Values) =>
      changePassword(values.currentPassword, values.newPassword),
    onSuccess: (message) => {
      toast.success(message);
      reset();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <BaseCardWrapper heading="Password">
      <form
        noValidate
        className="flex flex-col gap-4 max-w-md"
        onSubmit={handleSubmit((values) => change.mutate(values))}
      >
        <BaseInput
          name="currentPassword"
          control={control}
          type="password"
          autoComplete="current-password"
          label="Current password"
          rules={{ required: "Enter your current password" }}
        />
        <BaseInput
          name="newPassword"
          control={control}
          type="password"
          autoComplete="new-password"
          label="New password"
          description={PASSWORD_RULE_TEXT}
          rules={{
            required: "Enter a new password",
            validate: (value) =>
              PASSWORD_RULE.test(value) || PASSWORD_RULE_TEXT,
          }}
        />
        <BaseInput
          name="confirm"
          control={control}
          type="password"
          autoComplete="new-password"
          label="Confirm new password"
          rules={{
            required: "Enter the new password again",
            validate: (value) =>
              value === getValues("newPassword") || "The passwords don't match",
          }}
        />
        <p className="text-xs text-content-5">
          Changing your password signs you out on every other device.
        </p>
        <div>
          <BaseButton
            type="submit"
            text="Change Password"
            className="px-6"
            isLoading={change.isPending}
          />
        </div>
      </form>
    </BaseCardWrapper>
  );
}
