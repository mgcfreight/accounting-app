import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BaseButton } from "@/components/common";
import { SIGN_IN_CODE_PATTERN } from "@/lib/constants";
import { TwoFactorMethod } from "@/lib/enums";
import {
  errorMessage,
  SignedIn,
  SignInChallenge,
  verifyTwoFactorCode,
} from "@/services";
import CodeForm from "./code-form";
import EmailCodeStep from "./email-code-step";

// Warn when this few recovery codes are left after using one.
const LOW_RECOVERY_CODES = 3;

// Second step for a user with 2FA on: a code from the authenticator app or a
// recovery code, or one sent by email — whichever the challenge allows.
export default function TwoFactorStep({
  challenge,
  onSignedIn,
}: {
  challenge: SignInChallenge;
  onSignedIn: (result: SignedIn) => void;
}) {
  const hasApp = challenge.methods.includes(TwoFactorMethod.Totp);
  const hasEmail = challenge.methods.includes(TwoFactorMethod.Email);
  const [byEmail, setByEmail] = useState(!hasApp);

  const verify = useMutation({
    mutationFn: (code: string) =>
      verifyTwoFactorCode({ challengeToken: challenge.challengeToken, code }),
    onSuccess: (result, code) => {
      const remaining = result.recoveryCodesRemaining;
      if (
        !/^\d{6}$/.test(code) &&
        remaining !== undefined &&
        remaining <= LOW_RECOVERY_CODES
      ) {
        toast.warning(
          `You have ${remaining} recovery code${remaining === 1 ? "" : "s"} left. Ask an Admin to reset your 2FA if you've lost your authenticator.`
        );
      }
      onSignedIn(result);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <>
      <h2 className="text-xl font-bold mb-2">Two-step verification</h2>
      {byEmail ? (
        <EmailCodeStep
          challengeToken={challenge.challengeToken}
          onSignedIn={onSignedIn}
        />
      ) : (
        <>
          <p className="text-sm mb-4">
            Enter the 6-digit code from your authenticator app, or one of your
            recovery codes.
          </p>
          <CodeForm
            label="Code"
            placeholder="123456"
            pattern={SIGN_IN_CODE_PATTERN}
            patternMessage="Enter a 6-digit code or a recovery code"
            numeric={false}
            isSubmitting={verify.isPending}
            onSubmit={(code) => verify.mutate(code)}
          />
        </>
      )}
      {hasApp && hasEmail ? (
        <BaseButton
          text={byEmail ? "Use My Authenticator App" : "Email Me a Code Instead"}
          varient="light"
          className="w-full text-base-primary"
          onPress={() => setByEmail(!byEmail)}
        />
      ) : null}
    </>
  );
}
