import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { BaseButton, RHFTextField } from "@/components/common";
import { EMAIL_SHAPE, LOGIN_PATH } from "@/lib/constants";
import { errorMessage, forgotPassword } from "@/services";

type Values = { email: string };

// The API answers the same whether or not the email has an account, so the
// confirmation never says which.
export default function ForgotPasswordForm() {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ mode: "onTouched" });

  const onSubmit = async ({ email }: Values) => {
    setFormError(null);
    try {
      setSentMessage(await forgotPassword(email.trim()));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-base-primary mb-2">
        Reset your password
      </h2>
      {sentMessage ? (
        <p className="text-sm mb-8">{sentMessage}</p>
      ) : (
        <form noValidate onSubmit={handleSubmit(onSubmit)}>
          <p className="text-sm mb-6">
            Enter your email and we&apos;ll send you a link to choose a new
            password.
          </p>
          <RHFTextField<Values>
            name="email"
            register={register}
            error={errors.email}
            rules={{
              required: "Enter your email",
              validate: (value) =>
                EMAIL_SHAPE.test(value.trim()) || "Enter a valid email address",
            }}
            label="Email"
            autoComplete="username"
            className="mb-4"
          />
          {formError && (
            <p role="alert" className="text-sm text-base-danger text-center">
              {formError}
            </p>
          )}
          <BaseButton
            type="submit"
            text="Send reset link"
            isLoading={isSubmitting}
            className="my-6 w-full"
          />
        </form>
      )}
      <div className="text-center">
        <Link
          to={LOGIN_PATH}
          className="text-xs text-base-primary-300 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
