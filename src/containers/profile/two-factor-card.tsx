import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  BaseButton,
  BaseCardWrapper,
  BaseInput,
  FormModal,
  StatusChip,
} from "@/components/common";
import { SIGN_IN_CODE_PATTERN, SIX_DIGIT_CODE_PATTERN } from "@/lib/constants";
import { TwoFactorMethod } from "@/lib/enums";
import {
  disableTwoFactor,
  enableEmailTwoFactor,
  enableProfileAuthenticator,
  errorMessage,
  MyAccount,
  regenerateRecoveryCodes,
  sendProfileEmailCode,
  startProfileAuthenticatorSetup,
} from "@/services";
import CodeForm from "../login/code-form";
import RecoveryCodes from "../login/recovery-codes";

type Flow = "app" | "email" | "recovery" | "disable" | null;

// Two-step verification on your own account: turn it on with an
// authenticator app or email codes (whichever the server offers), replace
// app recovery codes, or turn it off (not for Admins). `onChanged` reloads
// the account after a change.
export default function TwoFactorCard({
  account,
  onChanged,
}: {
  account: MyAccount;
  onChanged: () => void;
}) {
  const [flow, setFlow] = useState<Flow>(null);
  // Shown once, right after the API sends them.
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const { user, twoFactor, recoveryCodesRemaining } = account;
  const offers = (method: TwoFactorMethod) =>
    twoFactor.availableMethods.includes(method);

  const finish = () => {
    setFlow(null);
    onChanged();
  };

  if (newCodes) {
    return (
      <BaseCardWrapper heading="Two-Step Verification">
        <div className="max-w-md">
          <RecoveryCodes codes={newCodes} onContinue={() => setNewCodes(null)} />
        </div>
      </BaseCardWrapper>
    );
  }

  return (
    <BaseCardWrapper heading="Two-Step Verification">
      <div className="flex flex-col gap-4 max-w-md text-sm">
        {user.twoFactorEnabled ? (
          <>
            <div className="flex items-center gap-2">
              <StatusChip text="On" tone="success" />
              <span>
                {twoFactor.authenticatorSetUp
                  ? "With an authenticator app"
                  : "With codes by email"}
              </span>
            </div>
            {twoFactor.authenticatorSetUp && (
              <p>
                {recoveryCodesRemaining} recovery code
                {recoveryCodesRemaining === 1 ? "" : "s"} left.
              </p>
            )}
            {flow === "recovery" ? (
              <ReplaceRecoveryCodes
                onDone={(codes) => {
                  setNewCodes(codes);
                  finish();
                }}
                onCancel={() => setFlow(null)}
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {twoFactor.authenticatorSetUp && (
                  <BaseButton
                    text="Replace Recovery Codes"
                    varient="bordered"
                    className="text-base-primary px-4"
                    onPress={() => setFlow("recovery")}
                  />
                )}
                {twoFactor.canTurnOff && (
                  <BaseButton
                    text="Turn Off"
                    varient="bordered"
                    className="text-base-danger px-4"
                    onPress={() => setFlow("disable")}
                  />
                )}
              </div>
            )}
            {!twoFactor.canTurnOff && (
              <p className="text-xs text-content-5">
                Admins must keep two-step verification on.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <StatusChip text="Off" tone="warning" />
              <span>A code is asked for at sign-in once this is on.</span>
            </div>
            {flow === null && (
              <div className="flex flex-wrap gap-2">
                {offers(TwoFactorMethod.Totp) && (
                  <BaseButton
                    text="Use an Authenticator App"
                    className="px-4"
                    onPress={() => setFlow("app")}
                  />
                )}
                {offers(TwoFactorMethod.Email) && (
                  <BaseButton
                    text="Use Codes by Email"
                    varient="bordered"
                    className="text-base-primary px-4"
                    onPress={() => setFlow("email")}
                  />
                )}
                {twoFactor.availableMethods.length === 0 && (
                  <p className="text-content-5">
                    This server offers no two-step methods yet.
                  </p>
                )}
              </div>
            )}
            {flow === "app" && (
              <AuthenticatorSetup
                onDone={(codes) => {
                  setNewCodes(codes);
                  finish();
                }}
                onCancel={() => setFlow(null)}
              />
            )}
            {flow === "email" && (
              <EmailSetup
                onDone={() => {
                  toast.success("Two-step verification is on.");
                  finish();
                }}
                onCancel={() => setFlow(null)}
              />
            )}
          </>
        )}
      </div>

      {flow === "disable" && (
        <TurnOffModal
          canEmailCode={offers(TwoFactorMethod.Email)}
          onDone={finish}
          onClose={() => setFlow(null)}
        />
      )}
    </BaseCardWrapper>
  );
}

const CancelButton = ({ onPress }: { onPress: () => void }) => (
  <BaseButton
    text="Cancel"
    varient="light"
    className="text-base-primary w-fit px-4"
    onPress={onPress}
  />
);

function AuthenticatorSetup({
  onDone,
  onCancel,
}: {
  onDone: (codes: string[]) => void;
  onCancel: () => void;
}) {
  const setup = useMutation({
    mutationFn: startProfileAuthenticatorSetup,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const enable = useMutation({
    mutationFn: enableProfileAuthenticator,
    onSuccess: (codes) => {
      toast.success("Two-step verification is on.");
      onDone(codes);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!setup.data) {
    return (
      <div className="flex gap-2">
        <BaseButton
          text="Show the QR Code"
          className="px-4"
          isLoading={setup.isPending}
          onPress={() => setup.mutate()}
        />
        <CancelButton onPress={onCancel} />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2">
        Scan this with your authenticator app, then enter the 6-digit code it
        shows.
      </p>
      {/* A checked PNG data URL (services/auth.ts). */}
      <img
        src={setup.data.qrCodeDataUrl}
        alt="QR code for your authenticator app"
        width={200}
        height={200}
        className="mb-2"
      />
      <p className="text-xs mb-4">
        Can&apos;t scan? Enter this key:{" "}
        <code className="break-all font-mono">{setup.data.secret}</code>
      </p>
      <CodeForm
        label="Code from the app"
        placeholder="123456"
        pattern={SIX_DIGIT_CODE_PATTERN}
        patternMessage="Enter the 6-digit code"
        submitText="Turn On"
        isSubmitting={enable.isPending}
        onSubmit={(code) => enable.mutate(code)}
      />
      <CancelButton onPress={onCancel} />
    </div>
  );
}

function EmailSetup({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const send = useMutation({
    mutationFn: sendProfileEmailCode,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const enable = useMutation({
    mutationFn: enableEmailTwoFactor,
    onSuccess: onDone,
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-2">
      {send.data ? (
        <>
          <p>We sent a code to {send.data.sentTo}.</p>
          <CodeForm
            label="Code from the email"
            placeholder="123456"
            pattern={SIX_DIGIT_CODE_PATTERN}
            patternMessage="Enter the 6-digit code"
            submitText="Turn On"
            isSubmitting={enable.isPending}
            onSubmit={(code) => enable.mutate(code)}
          />
          <BaseButton
            text="Send Another Code"
            varient="light"
            className="text-base-primary w-fit px-4"
            isLoading={send.isPending}
            onPress={() => send.mutate()}
          />
        </>
      ) : (
        <BaseButton
          text="Email Me a Code"
          className="w-fit px-4"
          isLoading={send.isPending}
          onPress={() => send.mutate()}
        />
      )}
      <CancelButton onPress={onCancel} />
    </div>
  );
}

function ReplaceRecoveryCodes({
  onDone,
  onCancel,
}: {
  onDone: (codes: string[]) => void;
  onCancel: () => void;
}) {
  const replace = useMutation({
    mutationFn: regenerateRecoveryCodes,
    onSuccess: (codes) => {
      toast.success("New recovery codes made. The old ones no longer work.");
      onDone(codes);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div>
      <p className="mb-2">
        Your old codes stop working. Confirm with a code from your
        authenticator app.
      </p>
      <CodeForm
        label="Code from the app"
        placeholder="123456"
        pattern={SIX_DIGIT_CODE_PATTERN}
        patternMessage="Enter the 6-digit code"
        submitText="Replace Codes"
        isSubmitting={replace.isPending}
        onSubmit={(code) => replace.mutate(code)}
      />
      <CancelButton onPress={onCancel} />
    </div>
  );
}

const stripSpaces = (value: string) => value.replace(/\s+/g, "");

function TurnOffModal({
  canEmailCode,
  onDone,
  onClose,
}: {
  canEmailCode: boolean;
  onDone: () => void;
  onClose: () => void;
}) {
  const { control, handleSubmit } = useForm({
    defaultValues: { password: "", code: "" },
  });
  const send = useMutation({
    mutationFn: sendProfileEmailCode,
    onSuccess: ({ sentTo }) => toast.success(`Code sent to ${sentTo}.`),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const turnOff = useMutation({
    mutationFn: ({ password, code }: { password: string; code: string }) =>
      disableTwoFactor({ password, code: stripSpaces(code) }),
    onSuccess: () => {
      toast.success("Two-step verification is off. Your other sessions were signed out.");
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <FormModal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      title="Turn Off Two-Step Verification"
      confirmText="Turn Off"
      isConfirming={turnOff.isPending}
      onConfirm={handleSubmit((values) => turnOff.mutate(values))}
    >
      <p className="text-sm">
        Confirm with your password and a current code. Your other sessions
        will be signed out.
      </p>
      <BaseInput
        name="password"
        control={control}
        type="password"
        label="Password"
        autoComplete="current-password"
        rules={{ required: "Enter your password" }}
      />
      <BaseInput
        name="code"
        control={control}
        label="Code"
        placeholder="From the app, a recovery code, or an email"
        autoComplete="one-time-code"
        rules={{
          required: "Enter a code",
          validate: (value: string) =>
            SIGN_IN_CODE_PATTERN.test(stripSpaces(value)) || "Enter a valid code",
        }}
      />
      {canEmailCode && (
        <BaseButton
          text="Email Me a Code"
          varient="light"
          className="text-base-primary w-fit px-2"
          isLoading={send.isPending}
          onPress={() => send.mutate()}
        />
      )}
    </FormModal>
  );
}
