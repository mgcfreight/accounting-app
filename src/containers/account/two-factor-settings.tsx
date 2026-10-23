import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AuthenticatorQr,
  BaseButton,
  BaseCardWrapper,
  BaseInput,
  DetailRow,
  FormModal,
  RecoveryCodes,
  StatusChip,
} from "@/components/common";
import { useCurrentUser, useUser } from "@/components/providers/user-provider";
import { TwoFactorMethod } from "@/lib/enums";
import {
  AuthenticatorSetup,
  disableTwoFactor,
  enableAuthenticator,
  enableEmailTwoFactor,
  errorMessage,
  regenerateRecoveryCodes,
  requestEmailCode,
  setUpAuthenticator,
} from "@/services";

type Flow = "authenticator" | "email" | "disable" | "recovery-codes" | null;
type Values = { code: string; password: string };

const SIX_DIGITS = /^\d{6}$/;

// The signed-in user's own two-factor sign-in. Admins must keep it on (the
// API refuses to turn it off for them). Every step needs a fresh code.
export default function TwoFactorSettings() {
  const me = useCurrentUser();
  const { refreshUser } = useUser();
  const [flow, setFlow] = useState<Flow>(null);
  const [setup, setSetup] = useState<AuthenticatorSetup | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const { control, handleSubmit, reset } = useForm<Values>({
    mode: "onTouched",
    defaultValues: { code: "", password: "" },
  });
  const { twoFactor } = me;
  const canEmail = twoFactor.availableMethods.includes(TwoFactorMethod.Email);
  const canApp = twoFactor.availableMethods.includes(TwoFactorMethod.Totp);

  const close = () => {
    setFlow(null);
    setSetup(null);
    setEmailSentTo(null);
    reset();
  };

  const fail = (error: unknown) => toast.error(errorMessage(error));

  // Opening a flow may need a first call: a new secret, or an emailed code.
  const start = useMutation({
    mutationFn: async (next: Exclude<Flow, null>) => {
      if (next === "authenticator") setSetup(await setUpAuthenticator());
      if (next === "email") setEmailSentTo((await requestEmailCode()).sentTo);
      return next;
    },
    onSuccess: (next) => {
      reset();
      setFlow(next);
    },
    onError: fail,
  });

  const sendDisableEmail = useMutation({
    mutationFn: requestEmailCode,
    onSuccess: (sent) => {
      setEmailSentTo(sent.sentTo);
      toast.success(`A code was sent to ${sent.sentTo}.`);
    },
    onError: fail,
  });

  const confirm = useMutation({
    mutationFn: async ({
      code,
      password,
    }: Values): Promise<string[] | null> => {
      const trimmed = code.replace(/\s/g, "");
      switch (flow) {
        case "authenticator":
          return (await enableAuthenticator(trimmed)).recoveryCodes;
        case "email":
          toast.success(await enableEmailTwoFactor(trimmed));
          return null;
        case "disable":
          toast.success(await disableTwoFactor(password, trimmed));
          return null;
        case "recovery-codes":
          return (await regenerateRecoveryCodes(trimmed)).recoveryCodes;
        default:
          return null;
      }
    },
    onSuccess: (codes) => {
      close();
      if (codes) setNewCodes(codes);
      void refreshUser();
    },
    onError: fail,
  });

  const titles: Record<Exclude<Flow, null>, string> = {
    authenticator: "Set Up Authenticator App",
    email: "Turn On Email Codes",
    disable: "Turn Off Two-Factor",
    "recovery-codes": "New Recovery Codes",
  };

  return (
    <BaseCardWrapper heading="Two-Factor Sign-in">
      <div className="flex flex-col gap-3 max-w-xl">
        <DetailRow
          label="Status"
          value={
            me.twoFactorEnabled ? (
              <StatusChip text="On" tone="success" />
            ) : (
              <StatusChip text="Off" tone="warning" />
            )
          }
        />
        <DetailRow
          label="Authenticator app"
          value={twoFactor.authenticatorSetUp ? "Set up" : "Not set up"}
        />
        {twoFactor.authenticatorSetUp && (
          <DetailRow
            label="Recovery codes left"
            value={me.recoveryCodesRemaining}
          />
        )}
        <div className="flex flex-wrap gap-3 mt-3">
          {canApp && !twoFactor.authenticatorSetUp && (
            <BaseButton
              text="Set Up Authenticator App"
              isLoading={start.isPending}
              onPress={() => start.mutate("authenticator")}
            />
          )}
          {canEmail && !me.twoFactorEnabled && (
            <BaseButton
              text="Use Email Codes"
              varient="bordered"
              className="text-base-primary"
              isLoading={start.isPending}
              onPress={() => start.mutate("email")}
            />
          )}
          {twoFactor.authenticatorSetUp && (
            <BaseButton
              text="New Recovery Codes"
              varient="bordered"
              className="text-base-primary"
              onPress={() => {
                reset();
                setFlow("recovery-codes");
              }}
            />
          )}
          {me.twoFactorEnabled && twoFactor.canTurnOff && (
            <BaseButton
              text="Turn Off"
              color="danger"
              varient="bordered"
              onPress={() => {
                reset();
                setEmailSentTo(null);
                setFlow("disable");
              }}
            />
          )}
        </div>
        {me.twoFactorEnabled && !twoFactor.canTurnOff && (
          <p className="text-xs text-content-5">
            Your role must keep two-factor sign-in on.
          </p>
        )}
      </div>

      {flow && (
        <FormModal
          isOpen
          onOpenChange={(open) => !open && close()}
          title={titles[flow]}
          confirmText={flow === "disable" ? "Turn Off" : "Confirm"}
          isConfirming={confirm.isPending}
          onConfirm={handleSubmit((values) => confirm.mutate(values))}
        >
          {flow === "authenticator" && setup && (
            <AuthenticatorQr
              qrCodeDataUrl={setup.qrCodeDataUrl}
              secret={setup.secret}
            />
          )}
          {flow === "email" && emailSentTo && (
            <p className="text-sm">
              Enter the 6-digit code we sent to {emailSentTo}.
            </p>
          )}
          {flow === "recovery-codes" && (
            <p className="text-sm">
              Enter a code from your authenticator app. Your old recovery codes
              stop working.
            </p>
          )}
          {flow === "disable" && (
            <>
              <p className="text-sm">
                Enter your password and a code from your authenticator app, a
                recovery code
                {canEmail ? ", or a code we email you" : ""}.
              </p>
              <BaseInput
                name="password"
                control={control}
                type="password"
                autoComplete="current-password"
                label="Password"
                rules={{ required: "Enter your password" }}
              />
            </>
          )}
          <BaseInput
            name="code"
            control={control}
            label="Code"
            autoComplete="one-time-code"
            rules={{
              required: "Enter the code",
              validate: (value) => {
                const code = value.replace(/\s/g, "");
                if (flow === "disable") {
                  return (
                    SIX_DIGITS.test(code) ||
                    /^[a-z2-7]{5}-?[a-z2-7]{5}$/i.test(code) ||
                    "A 6-digit code or a recovery code"
                  );
                }
                return SIX_DIGITS.test(code) || "The code is 6 digits";
              },
            }}
          />
          {flow === "disable" && canEmail && (
            <button
              type="button"
              className="text-xs text-base-primary-300 hover:underline self-start"
              disabled={sendDisableEmail.isPending}
              onClick={() => sendDisableEmail.mutate()}
            >
              {emailSentTo ? "Send another code" : "Email me a code"}
            </button>
          )}
        </FormModal>
      )}

      {newCodes && (
        <FormModal
          isOpen
          onOpenChange={(open) => !open && setNewCodes(null)}
          title="Your Recovery Codes"
          confirmText="I've Saved Them"
          onConfirm={() => setNewCodes(null)}
        >
          <RecoveryCodes codes={newCodes} />
        </FormModal>
      )}
    </BaseCardWrapper>
  );
}
