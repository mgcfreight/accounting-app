import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BaseButton } from "@/components/common";
import { SIX_DIGIT_CODE_PATTERN } from "@/lib/constants";
import { TwoFactorMethod } from "@/lib/enums";
import {
  enableAuthenticator,
  errorMessage,
  SignedIn,
  SignInChallenge,
  startAuthenticatorSetup,
} from "@/services";
import CodeForm from "./code-form";
import EmailCodeStep from "./email-code-step";

// An Admin without 2FA must set it up before signing in: an authenticator
// app (scan, then confirm with a code) or codes by email — whichever the
// server offers.
export default function TwoFactorSetupStep({
  challenge,
  onSignedIn,
}: {
  challenge: SignInChallenge;
  onSignedIn: (result: SignedIn) => void;
}) {
  const hasApp = challenge.methods.includes(TwoFactorMethod.Totp);
  const hasEmail = challenge.methods.includes(TwoFactorMethod.Email);
  const [method, setMethod] = useState<TwoFactorMethod | null>(
    hasApp && hasEmail ? null : (challenge.methods[0] ?? null)
  );
  const { challengeToken } = challenge;

  const setup = useMutation({
    mutationFn: () => startAuthenticatorSetup(challengeToken),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const enable = useMutation({
    mutationFn: (code: string) => enableAuthenticator({ challengeToken, code }),
    onSuccess: onSignedIn,
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <>
      <h2 className="text-xl font-bold mb-2">Set up two-step verification</h2>
      <p className="text-sm mb-4">
        Admins need a second step at every sign-in. Set it up now to continue.
      </p>

      {method === null ? (
        <div className="flex flex-col gap-3">
          <BaseButton
            text="Use an Authenticator App"
            onPress={() => setMethod(TwoFactorMethod.Totp)}
          />
          <BaseButton
            text="Use Codes by Email"
            varient="bordered"
            className="text-base-primary"
            onPress={() => setMethod(TwoFactorMethod.Email)}
          />
        </div>
      ) : null}

      {method === TwoFactorMethod.Email ? (
        <EmailCodeStep challengeToken={challengeToken} onSignedIn={onSignedIn} />
      ) : null}

      {method === TwoFactorMethod.Totp && !setup.data ? (
        <BaseButton
          text="Show the QR Code"
          isLoading={setup.isPending}
          className="my-4 w-full"
          onPress={() => setup.mutate()}
        />
      ) : null}

      {method === TwoFactorMethod.Totp && setup.data ? (
        <>
          <p className="text-sm mb-2">
            Scan this with your authenticator app, then enter the 6-digit code
            it shows.
          </p>
          <img
            src={setup.data.qrCodeDataUrl}
            alt="QR code for your authenticator app"
            width={200}
            height={200}
            className="mx-auto mb-2"
          />
          <p className="text-xs text-center mb-4">
            Can&apos;t scan? Enter this key:{" "}
            <code className="break-all font-mono">{setup.data.secret}</code>
          </p>
          <CodeForm
            label="Code from the app"
            placeholder="123456"
            pattern={SIX_DIGIT_CODE_PATTERN}
            patternMessage="Enter the 6-digit code"
            submitText="Turn On and Sign In"
            isSubmitting={enable.isPending}
            onSubmit={(code) => enable.mutate(code)}
          />
        </>
      ) : null}

      {hasApp && hasEmail && method !== null ? (
        <BaseButton
          text="Choose Another Way"
          varient="light"
          className="w-full text-base-primary"
          onPress={() => setMethod(null)}
        />
      ) : null}
    </>
  );
}
