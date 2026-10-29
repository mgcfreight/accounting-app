import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  AuthenticatorQr,
  BaseButton,
  RecoveryCodes,
  RHFTextField,
} from "@/components/common";
import { TwoFactorMethod } from "@/lib/enums";
import {
  AuthenticatorSetup,
  enableChallenge,
  errorMessage,
  sendEmailCode,
  startChallengeSetup,
  verifyEmailCode,
} from "@/services";
import type { Challenge } from "./login-form";
import {
  CHALLENGE_EXPIRED,
  isChallengeExpired,
  isSixDigits,
} from "./two-factor-step";

type CodeValues = { code: string };

// First sign-in for an account that must have 2FA (every Admin) but hasn't
// set it up: add an authenticator app, or — where the API allows it — use
// codes sent by email. Finishing either signs the user in.
export default function TwoFactorSetupStep({
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
  const [setup, setSetup] = useState<AuthenticatorSetup | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CodeValues>({ mode: "onTouched" });

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFormError(null);
    try {
      await action();
    } catch (error) {
      if (isChallengeExpired(error)) onRestart(CHALLENGE_EXPIRED);
      else setFormError(errorMessage(error));
      reset();
    } finally {
      setBusy(false);
    }
  };

  const chooseApp = () =>
    run(async () =>
      setSetup(await startChallengeSetup(challenge.challengeToken))
    );

  const chooseEmail = () =>
    run(async () =>
      setSentTo((await sendEmailCode(challenge.challengeToken)).sentTo)
    );

  const confirm = ({ code }: CodeValues) =>
    run(async () => {
      if (setup) {
        const result = await enableChallenge(
          challenge.challengeToken,
          code.trim()
        );
        // Signed in already; the codes must be seen before moving on.
        setRecoveryCodes(result.recoveryCodes);
      } else {
        await verifyEmailCode(challenge.challengeToken, code.trim());
        await onSignedIn(false);
      }
    });

  if (recoveryCodes) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-base-primary">
          Two-factor authentication is on
        </h2>
        <RecoveryCodes codes={recoveryCodes} />
        <BaseButton
          text="I've saved my codes — continue"
          className="mt-4 w-full"
          isLoading={busy}
          onPress={() => run(() => onSignedIn(false))}
        />
      </div>
    );
  }

  const choosing = !setup && !sentTo;

  return (
    <form
      noValidate
      onSubmit={handleSubmit(confirm)}
      className="flex flex-col gap-4"
    >
      <h2 className="text-lg font-semibold text-base-primary">
        Set up two-factor authentication
      </h2>
      {choosing && (
        <>
          <p className="text-sm">
            Your account needs a second step at sign-in. Choose how you&apos;ll
            get your codes.
          </p>
          {canUseApp && (
            <BaseButton
              text="Use an authenticator app"
              isLoading={busy}
              onPress={chooseApp}
            />
          )}
          {canUseEmail && (
            <BaseButton
              text="Email me codes"
              varient="bordered"
              className="text-base-primary"
              isLoading={busy}
              onPress={chooseEmail}
            />
          )}
        </>
      )}
      {setup && (
        <AuthenticatorQr
          qrCodeDataUrl={setup.qrCodeDataUrl}
          secret={setup.secret}
        />
      )}
      {sentTo && (
        <p className="text-sm">Enter the 6-digit code we sent to {sentTo}.</p>
      )}
      {!choosing && (
        <>
          <RHFTextField<CodeValues>
            name="code"
            register={register}
            error={errors.code}
            rules={{
              required: "Enter the code",
              // Six digits is the whole code, so it goes straight in.
              onChange: (event) => {
                if (!busy && isSixDigits(event.target.value)) {
                  void handleSubmit(confirm)();
                }
              },
              validate: (value) =>
                isSixDigits(value) || "The code is 6 digits",
            }}
            label="6-digit code"
            autoComplete="one-time-code"
            inputMode="numeric"
            autoFocus
          />
          <BaseButton
            type="submit"
            text="Turn on"
            isLoading={busy}
            className="w-full"
          />
        </>
      )}
      {formError && (
        <p role="alert" className="text-sm text-base-danger text-center">
          {formError}
        </p>
      )}
      <button
        type="button"
        className="text-xs text-content-5 hover:underline"
        onClick={() => onRestart("")}
      >
        Back to sign in
      </button>
    </form>
  );
}
