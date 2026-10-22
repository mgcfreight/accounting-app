import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { toast } from "sonner";
import { BaseButton, RHFTextField } from "@/components/common";
import { EMAIL_PATTERN, LOGIN_PATH } from "@/lib/constants";
import { errorMessage, requestPasswordReset } from "@/services";

interface ForgotPasswordValues {
  email: string;
}

// Asks the API to email a reset link. It answers the same whether or not the
// email has an account, and sends nothing to a user whose only second step
// is email (a mailbox alone must not be enough), so this page can't say more.
export default function ForgotPasswordForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({ mode: "onTouched" });

  const request = useMutation({
    mutationFn: ({ email }: ForgotPasswordValues) =>
      requestPasswordReset(email.trim()),
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (request.isSuccess) {
    return (
      <>
        <h2 className="text-xl font-bold mb-2">Check your email</h2>
        <p className="text-sm mb-8">
          If there&apos;s an account for that email, a reset link is on its
          way. It works once and expires soon. No email? Ask an Admin to set
          your password.
        </p>
        <Link to={LOGIN_PATH} className="text-sm font-semibold text-base-primary">
          Back to sign in
        </Link>
      </>
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => request.mutate(values))}
    >
      <h2 className="text-xl font-bold mb-2">Forgot your password?</h2>
      <p className="text-sm mb-4">
        Enter your email and we&apos;ll send you a link to set a new one.
      </p>
      <RHFTextField<ForgotPasswordValues>
        name="email"
        register={register}
        error={errors.email}
        rules={{
          required: "Enter your email",
          validate: (value) =>
            EMAIL_PATTERN.test(value.trim()) || "Enter a valid email address",
        }}
        label="Email"
        placeholder="yourid@mgcfreight.com"
        autoComplete="username"
        className="mb-4"
      />
      <BaseButton
        type="submit"
        text="Send Reset Link"
        isLoading={request.isPending}
        className="my-6 w-full"
      />
      <Link to={LOGIN_PATH} className="text-sm font-semibold text-base-primary">
        Back to sign in
      </Link>
    </form>
  );
}
