import { useState } from "react";
import { useForm } from "react-hook-form";
import { BaseButton, RHFTextField } from "@/components/common";
import { TwoFactorMethod } from "@/lib/enums";
import {
  ApiError,
  errorMessage,
  sendEmailCode,
  SignedIn,
  verifyEmailCode,
  verifyTwoFactor,
} from "@/services";
import type { Challenge } from "./login-form";

type CodeValues = { code: string };

// The API sends no error codes, only messages: this is its message for an
// expired, used or unknown challenge (auth.service INVALID_CHALLENGE). A
// wrong code is also a 401, with a different message, and stays on the step.
export const CHALLENGE_EXPIRED =
  "Your sign-in has expired. Please sign in again.";

export const isChallengeExpired = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 401 &&
  error.message === CHALLENGE_EXPIRED;

const LOW_RECOVERY_CODES = 3;

export const isSixDigits = (value: string) =>
  /^\d{6}$/.test(value.replace(/\s/g, ""));

export const warnIfFewRecoveryCodes = (signedIn: SignedIn) =>
  signedIn.user.twoFactorEnabled &&
  signedIn.recoveryCodesRemaining < LOW_RECOVERY_CODES;

// Second sign-in step: a code from the authenticator app, a recovery code,
// or (if the account allows it) a code sent by email.
export default function TwoFactorStep({
  challenge,
  onSignedIn,
  onRestart,
}: {
  challenge: Challenge;
  onSignedIn: (warnLowCodes: boolean) => Promise<void>;
  onRestart: (message: string) => void;
}) {
  const canUseApp = challenge.methods.includes(TwoFactorMethod.Totp);
  const canUseEmail = challenge.methods.includes(TwoFactorMethod.Email);
  const [mode, setMode] = useState<"app" | "email">(
    canUseApp ? "app" : "email"
  );
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CodeValues>({ mode: "onTouched" });

  const fail = (error: unknown) => {
    if (isChallengeExpired(error)) onRestart(CHALLENGE_EXPIRED);
    else setFormError(errorMessage(error));
  };

  const emailMe = async () => {
    setSending(true);
    setFormError(null);
    try {
      const sent = await sendEmailCode(challenge.challengeToken);
      setSentTo(sent.sentTo);
      setMode("email");
      reset();
    } catch (error) {
      fail(error);
    } finally {
      setSending(false);
    }
  };

  const onSubmit = async ({ code }: CodeValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const signedIn =
        mode === "email"
          ? await verifyEmailCode(challenge.challengeToken, code.trim())
          : await verifyTwoFactor(challenge.challengeToken, code.trim());
      await onSignedIn(warnIfFewRecoveryCodes(signedIn));
    } catch (error) {
      fail(error);
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <h2 className="text-lg font-semibold text-base-primary mb-2">
        Two-factor authentication
      </h2>
      <p className="text-sm mb-6">
        {mode === "app"
          ? "Enter the 6-digit code from your authenticator app, or one of your recovery codes."
          : sentTo
            ? `Enter the 6-digit code we sent to ${sentTo}.`
            : "We'll email you a 6-digit code."}
      </p>
      {(mode === "app" || sentTo) && (
        <RHFTextField<CodeValues>
          name="code"
          register={register}
          error={errors.code}
          rules={{
            required: "Enter the code",
            // A 6-digit code is complete once typed or pasted, so it goes
            // straight in; a recovery code still waits for Verify.
            onChange: (event) => {
              if (!submitting && isSixDigits(event.target.value)) {
                void handleSubmit(onSubmit)();
              }
            },
            validate: (value) => {
              const code = value.replace(/\s/g, "");
              if (mode === "email") {
                return /^\d{6}$/.test(code) || "The code is 6 digits";
              }
              return (
                /^\d{6}$/.test(code) ||
                /^[a-z2-7]{5}-?[a-z2-7]{5}$/i.test(code) ||
                "Enter a 6-digit code or a recovery code"
              );
            },
          }}
          label={mode === "app" ? "Authentication code" : "Email code"}
          autoComplete="one-time-code"
          inputMode={mode === "email" ? "numeric" : "text"}
          autoFocus
          className="mb-4"
        />
      )}
      {formError && (
        <p role="alert" className="mb-4 text-sm text-base-danger text-center">
          {formError}
        </p>
      )}
      {mode === "email" && !sentTo ? (
        <BaseButton
          text="Email me a code"
          isLoading={sending}
          className="my-6 w-full"
          onPress={emailMe}
        />
      ) : (
        <BaseButton
          type="submit"
          text="Verify"
          isLoading={submitting}
          className="my-6 w-full"
        />
      )}
      <div className="flex flex-col items-center gap-2 text-xs">
        {canUseEmail && mode === "app" && (
          <button
            type="button"
            className="text-base-primary-300 hover:underline"
            onClick={emailMe}
            disabled={sending}
          >
            Email me a code instead
          </button>
        )}
        {canUseEmail && mode === "email" && sentTo && (
          <button
            type="button"
            className="text-base-primary-300 hover:underline"
            onClick={emailMe}
            disabled={sending}
          >
            Send a new code
          </button>
        )}
        {canUseApp && mode === "email" && (
          <button
            type="button"
            className="text-base-primary-300 hover:underline"
            onClick={() => {
              setMode("app");
              setFormError(null);
              reset();
            }}
          >
            Use my authenticator app or a recovery code
          </button>
        )}
        <button
          type="button"
          className="text-content-5 hover:underline"
          onClick={() => onRestart("")}
        >
          Back to sign in
        </button>
      </div>
    </form>
  );
}
