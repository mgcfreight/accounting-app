import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";
import { BaseButton, RHFPasswordField } from "@/components/common";
import {
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
  PASSWORD_RULE,
  PASSWORD_RULE_TEXT,
} from "@/lib/constants";
import { errorMessage, resetPassword } from "@/services";

type Values = { password: string; confirm: string };

// The token's shape as the API issues it; anything else is a broken link.
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

// Opened from the reset email (/reset-password/?token=…). A successful reset
// ends every session, so the user signs in again afterwards.
export default function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ mode: "onTouched" });

  const onSubmit = async ({ password }: Values) => {
    setFormError(null);
    try {
      setDoneMessage(await resetPassword(token, password));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  if (!TOKEN_SHAPE.test(token)) {
    return (
      <div className="text-center">
        <p className="text-sm mb-6">
          This password reset link is invalid or has expired.
        </p>
        <Link
          to={FORGOT_PASSWORD_PATH}
          className="text-xs text-base-primary-300 hover:underline"
        >
          Ask for a new link
        </Link>
      </div>
    );
  }

  if (doneMessage) {
    return (
      <div className="text-center">
        <p className="text-sm mb-6">{doneMessage}</p>
        <BaseButton
          as={Link}
          to={LOGIN_PATH}
          text="Sign in"
          className="w-full"
        />
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <h2 className="text-lg font-semibold text-base-primary mb-2">
        Choose a new password
      </h2>
      <p className="text-xs text-content-5 mb-6">{PASSWORD_RULE_TEXT}</p>
      <RHFPasswordField<Values>
        name="password"
        register={register}
        error={errors.password}
        rules={{
          required: "Enter a new password",
          validate: (value) => PASSWORD_RULE.test(value) || PASSWORD_RULE_TEXT,
        }}
        label="New password"
        autoComplete="new-password"
        className="mb-4"
      />
      <RHFPasswordField<Values>
        name="confirm"
        register={register}
        error={errors.confirm}
        rules={{
          required: "Enter the password again",
          validate: (value) =>
            value === getValues("password") || "The passwords don't match",
        }}
        label="Confirm new password"
        autoComplete="new-password"
        className="mb-4"
      />
      {formError && (
        <p role="alert" className="text-sm text-base-danger text-center">
          {formError}
        </p>
      )}
      <BaseButton
        type="submit"
        text="Reset password"
        isLoading={isSubmitting}
        className="my-6 w-full"
      />
      <div className="text-center">
        <Link
          to={LOGIN_PATH}
          className="text-xs text-base-primary-300 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </form>
  );
}
