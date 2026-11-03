import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AlertBanner,
  BaseButton,
  BaseCardWrapper,
  BasePasswordInput,
} from "@/components/common";
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
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) => change.mutate(values))}
      >
        <BasePasswordInput
          name="currentPassword"
          control={control}
          autoComplete="current-password"
          label="Current password"
          rules={{ required: "Enter your current password" }}
        />
        <BasePasswordInput
          name="newPassword"
          control={control}
          autoComplete="new-password"
          label="New password"
          description={PASSWORD_RULE_TEXT}
          rules={{
            required: "Enter a new password",
            validate: (value) =>
              PASSWORD_RULE.test(value) || PASSWORD_RULE_TEXT,
          }}
        />
        <BasePasswordInput
          name="confirm"
          control={control}
          autoComplete="new-password"
          label="Confirm new password"
          rules={{
            required: "Enter the new password again",
            validate: (value) =>
              value === getValues("newPassword") || "The passwords don't match",
          }}
        />
        <AlertBanner message="Changing your password signs you out on every other device." />
        <div>
          <BaseButton
            type="submit"
            text="Change Password"
            className="w-full px-6 sm:w-auto"
            isLoading={change.isPending}
          />
        </div>
      </form>
    </BaseCardWrapper>
  );
}
