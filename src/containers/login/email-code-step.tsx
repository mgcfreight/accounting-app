import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { BaseButton } from "@/components/common";
import { SIX_DIGIT_CODE_PATTERN } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import {
  errorMessage,
  SignedIn,
  sendSignInEmailCode,
  verifySignInEmailCode,
} from "@/services";
import CodeForm from "./code-form";

// Second step by email: send a code, then enter it. Also how an Admin
// without 2FA turns it on by email. The code is sent only when asked, since
// the API allows one email a minute.
export default function EmailCodeStep({
  challengeToken,
  onSignedIn,
}: {
  challengeToken: string;
  onSignedIn: (result: SignedIn) => void;
}) {
  const send = useMutation({
    mutationFn: () => sendSignInEmailCode(challengeToken),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const verify = useMutation({
    mutationFn: (code: string) =>
      verifySignInEmailCode({ challengeToken, code }),
    onSuccess: onSignedIn,
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!send.data) {
    return (
      <BaseButton
        text="Email Me a Code"
        isLoading={send.isPending}
        className="my-4 w-full"
        onPress={() => send.mutate()}
      />
    );
  }

  return (
    <>
      <p className="text-sm mb-4">
        We sent a 6-digit code to {send.data.sentTo}. It expires{" "}
        {formatDateTime(send.data.expiresAt)}.
      </p>
      <CodeForm
        label="Code from the email"
        placeholder="123456"
        pattern={SIX_DIGIT_CODE_PATTERN}
        patternMessage="Enter the 6-digit code"
        isSubmitting={verify.isPending}
        onSubmit={(code) => verify.mutate(code)}
      />
      <BaseButton
        text="Send a New Code"
        varient="light"
        isLoading={send.isPending}
        className="w-full text-base-primary"
        onPress={() => send.mutate()}
      />
    </>
  );
}
