import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";
import { BaseButton, RHFPasswordField, RHFTextField } from "@/components/common";
import { useUser } from "@/components/providers/user-provider";
import {
  EMAIL_SHAPE,
  FORGOT_PASSWORD_PATH,
  HOME_PATH,
} from "@/lib/constants";
import { SignInStep } from "@/lib/enums";
import { errorMessage, login, LoginResult } from "@/services";
import TwoFactorSetupStep from "./two-factor-setup-step";
import TwoFactorStep from "./two-factor-step";

interface LoginFormValues {
  email: string;
  password: string;
}

export type Challenge = Exclude<LoginResult, { nextStep: SignInStep.SignedIn }>;

// After sign-in, back to the page that sent the visitor here (AppLayout puts
// it in `state.from`) — only ever a path inside this app.
const returnPath = (state: unknown) => {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === "string" && from.startsWith("/") && !from.startsWith("//")
    ? from
    : HOME_PATH;
};

// mokal-app's login form, minus sign-up (Accounts users are created by an
// Admin on the Users page). Email and password first; the API then either
// signs in or asks for a two-factor code (or, the first time, for 2FA to be
// set up), which the steps below handle. The session is the API's httpOnly
// cookie: this form never sees a token.
export default function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useUser();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  // No `defaultValues`: the fields are registered native inputs, and a
  // declared default would overwrite credentials the browser autofilled.
  const {
    register,
    handleSubmit,
    resetField,
    formState: { errors },
  } = useForm<LoginFormValues>({ mode: "onTouched" });

  const finishSignIn = async (warnLowCodes = false) => {
    if (warnLowCodes) {
      toast.warning(
        "You're running low on recovery codes. Make new ones in My Account."
      );
    }
    await refreshUser();
    navigate(returnPath(location.state), { replace: true });
  };

  // The challenge expired or was refused: start again from the password.
  const restart = (message: string) => {
    setChallenge(null);
    resetField("password");
    setFormError(message);
  };

  const onSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setFormError(null);
    try {
      const result = await login({
        email: values.email.trim(),
        password: values.password,
      });
      if (result.nextStep === SignInStep.SignedIn) {
        await finishSignIn(false);
      } else {
        setChallenge(result);
      }
    } catch (error) {
      // "Invalid credentials" for a wrong email, password or a locked
      // account alike: the API never says which.
      setFormError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (challenge?.nextStep === SignInStep.TwoFactor) {
    return (
      <TwoFactorStep
        challenge={challenge}
        onSignedIn={finishSignIn}
        onRestart={restart}
      />
    );
  }
  if (challenge?.nextStep === SignInStep.TwoFactorSetup) {
    return (
      <TwoFactorSetupStep
        challenge={challenge}
        onSignedIn={finishSignIn}
        onRestart={restart}
      />
    );
  }

  return (
    <form method="post" noValidate onSubmit={handleSubmit(onSubmit)}>
      <RHFTextField<LoginFormValues>
        name="email"
        register={register}
        error={errors.email}
        rules={{
          required: "Enter your email",
          validate: (value) =>
            EMAIL_SHAPE.test(value.trim()) || "Enter a valid email address",
        }}
        label="Email"
        placeholder="yourid@mgcfreight.com"
        autoComplete="username"
        className="mb-4"
      />
      <RHFPasswordField<LoginFormValues>
        name="password"
        register={register}
        error={errors.password}
        rules={{ required: "Password is required" }}
        label="Password"
        placeholder="Enter Password"
        autoComplete="current-password"
        className="mb-2"
      />
      <div className="flex justify-end">
        <Link
          to={FORGOT_PASSWORD_PATH}
          className="text-xs text-base-primary-300 hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      {formError && (
        <p role="alert" className="mt-4 text-sm text-base-danger text-center">
          {formError}
        </p>
      )}
      <BaseButton
        type="submit"
        text="Login"
        isLoading={loading}
        className="my-6 w-full"
      />
    </form>
  );
}
