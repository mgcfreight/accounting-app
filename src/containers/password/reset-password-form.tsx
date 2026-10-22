import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { BaseButton, RHFPasswordField } from "@/components/common";
import {
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  PASSWORD_PATTERN,
  PASSWORD_RULE,
  RESET_TOKEN_PATTERN,
} from "@/lib/constants";
import { errorMessage, resetPassword } from "@/services";

interface ResetPasswordValues {
  password: string;
  confirmPassword: string;
}

// The page the reset email links to (`?token=…`). Setting the password signs
// the user out everywhere; 2FA stays as it was.
export default function ResetPasswordForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ResetPasswordValues>({ mode: "onTouched" });

  const reset = useMutation({
    mutationFn: ({ password }: ResetPasswordValues) =>
      resetPassword({ token, password }),
    onSuccess: () => {
      toast.success("Password changed. Sign in with your new password.");
      navigate(LOGIN_PATH);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  // Checked here too (security.md): a URL is input like any other.
  if (!RESET_TOKEN_PATTERN.test(token)) {
    return (
      <>
        <h2 className="text-xl font-bold mb-2">This link doesn&apos;t work</h2>
        <p className="text-sm mb-8">
          Open the link from your email again, or ask for a new one.
        </p>
        <Link
          to={FORGOT_PASSWORD_PATH}
          className="text-sm font-semibold text-base-primary"
        >
          Send a new link
        </Link>
      </>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit((values) => reset.mutate(values))}>
      <h2 className="text-xl font-bold mb-2">Set a new password</h2>
      <p className="text-sm mb-4">{PASSWORD_RULE}</p>
      <RHFPasswordField<ResetPasswordValues>
        name="password"
        register={register}
        error={errors.password}
        rules={{
          required: "Enter a new password",
          validate: (value) => PASSWORD_PATTERN.test(value) || PASSWORD_RULE,
        }}
        label="New password"
        autoComplete="new-password"
        className="mb-4"
      />
      <RHFPasswordField<ResetPasswordValues>
        name="confirmPassword"
        register={register}
        error={errors.confirmPassword}
        rules={{
          required: "Enter the password again",
          validate: (value) =>
            value === getValues("password") || "The passwords don't match",
        }}
        label="Confirm new password"
        autoComplete="new-password"
        className="mb-4"
      />
      <BaseButton
        type="submit"
        text="Set Password"
        isLoading={reset.isPending}
        className="my-6 w-full"
      />
    </form>
  );
}
