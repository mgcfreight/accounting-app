import { useMutation } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  AuthenticatorQr,
  BaseButton,
  BaseCardWrapper,
  BaseInput,
  BasePasswordInput,
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
// At or below this many recovery codes, the page warns to make new ones.
const LOW_RECOVERY_CODES = 3;

// One way of signing in: what it is, its state, and its action, which sits
// on the right on wider screens and below on a phone.
function MethodRow({
  title,
  detail,
  action,
}: {
  title: string;
  detail: ReactNode;
  action?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#343A40]">{title}</p>
        <p className="wrap-break-word text-xs text-content-5">{detail}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </li>
  );
}

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
      <div className="flex flex-col gap-4">
        <div
          role="status"
          className={`flex items-start gap-3 rounded-lg border p-3 ${
            me.twoFactorEnabled
              ? "border-success bg-success-50"
              : "border-warning bg-warning-50"
          }`}
        >
          <StatusChip
            text={me.twoFactorEnabled ? "On" : "Off"}
            tone={me.twoFactorEnabled ? "success" : "warning"}
          />
          <p className="text-sm text-[#343A40]">
            {me.twoFactorEnabled
              ? "Signing in needs your password and a code, so a stolen password alone can't get in."
              : "Only your password protects this account. Turn on two-factor sign-in below."}
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-content-3 rounded-lg border border-base-default">
          {(canApp || twoFactor.authenticatorSetUp) && (
            <MethodRow
              title="Authenticator app"
              detail={
                twoFactor.authenticatorSetUp
                  ? "Set up. Codes come from the app on your phone."
                  : "Not set up. Use an app like Google or Microsoft Authenticator."
              }
              action={
                canApp &&
                !twoFactor.authenticatorSetUp && (
                  <BaseButton
                    text="Set Up"
                    className="w-full px-4 sm:w-auto"
                    isLoading={start.isPending}
                    onPress={() => start.mutate("authenticator")}
                  />
                )
              }
            />
          )}
          {canEmail && (
            <MethodRow
              title="Email codes"
              detail={`A 6-digit code sent to ${me.email} when you sign in.`}
              action={
                !me.twoFactorEnabled && (
                  <BaseButton
                    text="Use Email Codes"
                    varient="bordered"
                    className="w-full px-4 text-base-primary sm:w-auto"
                    isLoading={start.isPending}
                    onPress={() => start.mutate("email")}
                  />
                )
              }
            />
          )}
          {twoFactor.authenticatorSetUp && (
            <MethodRow
              title="Recovery codes"
              detail={
                <span
                  className={
                    me.recoveryCodesRemaining <= LOW_RECOVERY_CODES ? "text-base-danger" : ""
                  }
                >
                  {me.recoveryCodesRemaining} left.{" "}
                  {me.recoveryCodesRemaining <= LOW_RECOVERY_CODES
                    ? "Running low: make new ones before you run out."
                    : "Each signs you in once if you lose your phone."}
                </span>
              }
              action={
                <BaseButton
                  text="New Codes"
                  varient="bordered"
                  className="w-full px-4 text-base-primary sm:w-auto"
                  onPress={() => {
                    reset();
                    setFlow("recovery-codes");
                  }}
                />
              }
            />
          )}
        </ul>

        {me.twoFactorEnabled && twoFactor.canTurnOff && (
          <div className="flex flex-col gap-2 border-t border-content-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-content-5">
              Turning it off leaves only your password protecting this account.
            </p>
            <BaseButton
              text="Turn Off Two-Factor"
              color="danger"
              varient="bordered"
              className="w-full px-4 sm:w-auto"
              onPress={() => {
                reset();
                setEmailSentTo(null);
                setFlow("disable");
              }}
            />
          </div>
        )}
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
          confirmColor={flow === "disable" ? "danger" : "primary"}
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
              <BasePasswordInput
                name="password"
                control={control}
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
            inputMode={flow === "disable" ? "text" : "numeric"}
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
              className="text-xs text-base-primary-300 underline self-start"
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
          requireConfirm
        >
          <RecoveryCodes codes={newCodes} />
        </FormModal>
      )}
    </BaseCardWrapper>
  );
}
