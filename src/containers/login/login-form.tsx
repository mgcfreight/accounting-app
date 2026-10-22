import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { BaseButton, RHFPasswordField, RHFTextField } from "@/components/common";
import { useUser } from "@/components/providers/user-provider";
import { EMAIL_PATTERN, FORGOT_PASSWORD_PATH, HOME_PATH } from "@/lib/constants";
import { SignInStep } from "@/lib/enums";
import {
  Credentials,
  errorMessage,
  signIn,
  SignedIn,
  SignInChallenge,
} from "@/services";
import RecoveryCodes from "./recovery-codes";
import TwoFactorSetupStep from "./two-factor-setup-step";
import TwoFactorStep from "./two-factor-step";

type Step =
  | { kind: "credentials" }
  | { kind: "challenge"; challenge: SignInChallenge }
  | { kind: "recovery-codes"; signedIn: SignedIn };

// mokal-app's login form, minus sign-up (Accounts users are created by an
// Admin in Settings). Email and password first; then, when the API asks,
// a 2FA code or — for an Admin without 2FA — setting it up. Setting up an
// authenticator app ends on the one-time recovery codes.
export default function LoginForm() {
  const navigate = useNavigate();
  const { setUser } = useUser();
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  // No `defaultValues`: the fields are registered native inputs, and a
  // declared default would overwrite credentials the browser autofilled.
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Credentials>({ mode: "onTouched" });

  const finish = (signedIn: SignedIn) => {
    setUser(signedIn.user);
    navigate(HOME_PATH);
  };

  const onSignedIn = (signedIn: SignedIn) =>
    signedIn.recoveryCodes?.length
      ? setStep({ kind: "recovery-codes", signedIn })
      : finish(signedIn);

  const login = useMutation({
    mutationFn: (credentials: Credentials) =>
      signIn({ ...credentials, email: credentials.email.trim() }),
    onSuccess: (result) =>
      result.nextStep === SignInStep.SignedIn
        ? onSignedIn(result)
        : setStep({ kind: "challenge", challenge: result }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (step.kind === "recovery-codes") {
    return (
      <RecoveryCodes
        codes={step.signedIn.recoveryCodes ?? []}
        onContinue={() => finish(step.signedIn)}
      />
    );
  }

  if (step.kind === "challenge") {
    const { challenge } = step;
    return (
      <>
        {challenge.nextStep === SignInStep.TwoFactorSetup ? (
          <TwoFactorSetupStep challenge={challenge} onSignedIn={onSignedIn} />
        ) : (
          <TwoFactorStep challenge={challenge} onSignedIn={onSignedIn} />
        )}
        {/* The challenge lasts a few minutes; past that, start over. */}
        <BaseButton
          text="Back to Sign In"
          varient="light"
          className="w-full mt-2"
          onPress={() => setStep({ kind: "credentials" })}
        />
      </>
    );
  }

  return (
    <form
      method="post"
      noValidate
      onSubmit={handleSubmit((credentials) => login.mutate(credentials))}
    >
      <RHFTextField<Credentials>
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
      <RHFPasswordField<Credentials>
        name="password"
        register={register}
        error={errors.password}
        rules={{ required: "Password is required" }}
        label="Password"
        placeholder="Enter Password"
        autoComplete="current-password"
        className="mb-4"
      />
      <div className="text-right">
        <Link
          to={FORGOT_PASSWORD_PATH}
          className="text-xs font-semibold text-base-primary"
        >
          Forgot password?
        </Link>
      </div>
      <BaseButton
        type="submit"
        text="Login"
        isLoading={login.isPending}
        className="my-8 w-full"
      />
    </form>
  );
}
