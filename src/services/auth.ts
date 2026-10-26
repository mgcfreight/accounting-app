import { z } from "zod";
import { apiClient, parseBody } from "./api-client";
import {
  authenticatorSetupSchema,
  emailCodeSentSchema,
  envelope,
  loginResultSchema,
  meSchema,
  messageOnly,
  recoveryCodesSchema,
  signedInSchema,
} from "./schemas";

// Sign-in, two-factor and password endpoints (/auth). The API sets and clears
// the session cookies itself; nothing here sees a token.
//
// Two-factor sign-in: login() either signs in or returns a `challengeToken`
// for the next step — a code (verifyTwoFactor / verifyEmailCode) or, for an
// account that must set 2FA up first, startChallengeSetup + enableChallenge.
// The challenge expires after 5 minutes.

export type Credentials = { email: string; password: string };

export type LoginResult = z.infer<typeof loginResultSchema>;
export type SignedIn = z.infer<typeof signedInSchema>;
export type AuthenticatorSetup = z.infer<typeof authenticatorSetupSchema>;
export type EmailCodeSent = z.infer<typeof emailCodeSentSchema>;

// The signed-in user; a 401 (after one refresh attempt) means nobody is.
export const getMe = (signal?: AbortSignal) =>
  apiClient
    .get("/auth/me", { signal })
    .then((res) => parseBody(envelope(meSchema), res.data).data);

export const login = (credentials: Credentials) =>
  apiClient
    .post("/auth/login", credentials)
    .then((res) => parseBody(envelope(loginResultSchema), res.data).data);

// `code` is an authenticator-app code or a recovery code.
export const verifyTwoFactor = (challengeToken: string, code: string) =>
  apiClient
    .post("/auth/2fa/verify", { challengeToken, code })
    .then((res) => parseBody(envelope(signedInSchema), res.data).data);

export const sendEmailCode = (challengeToken: string) =>
  apiClient
    .post("/auth/2fa/email/send", { challengeToken })
    .then((res) => parseBody(envelope(emailCodeSentSchema), res.data).data);

export const verifyEmailCode = (challengeToken: string, code: string) =>
  apiClient
    .post("/auth/2fa/email/verify", { challengeToken, code })
    .then((res) => parseBody(envelope(signedInSchema), res.data).data);

// TWO_FACTOR_SETUP step: a new authenticator secret and QR code.
export const startChallengeSetup = (challengeToken: string) =>
  apiClient
    .post("/auth/2fa/setup", { challengeToken })
    .then((res) => parseBody(envelope(authenticatorSetupSchema), res.data).data);

// Confirms the app with its first code; signs in and returns the recovery
// codes, shown once.
export const enableChallenge = (challengeToken: string, code: string) =>
  apiClient
    .post("/auth/2fa/enable", { challengeToken, code })
    .then(
      (res) =>
        parseBody(
          envelope(
            signedInSchema.extend({
              recoveryCodes: z.array(z.string()).min(1),
            })
          ),
          res.data
        ).data
    );

export const logout = () =>
  apiClient.post("/auth/logout").then(() => undefined);

// Always succeeds, whether or not the email has an account (no enumeration).
export const forgotPassword = (email: string) =>
  apiClient
    .post("/auth/forgot-password", { email })
    .then((res) => parseBody(messageOnly, res.data).message);

export const resetPassword = (token: string, password: string) =>
  apiClient
    .post("/auth/reset-password", { token, password })
    .then((res) => parseBody(messageOnly, res.data).message);

// The API replaces the session cookies; other devices are signed out.
export const changePassword = (currentPassword: string, newPassword: string) =>
  apiClient
    .put("/auth/change-password", { currentPassword, newPassword })
    .then((res) => parseBody(messageOnly, res.data).message);

// Signed-in two-factor management (My Account).

export const setUpAuthenticator = () =>
  apiClient
    .post("/auth/2fa/authenticator/setup")
    .then((res) => parseBody(envelope(authenticatorSetupSchema), res.data).data);

export const enableAuthenticator = (code: string) =>
  apiClient
    .post("/auth/2fa/authenticator/enable", { code })
    .then((res) => parseBody(envelope(recoveryCodesSchema), res.data).data);

// Emails a code, used to turn on email 2FA or to confirm turning 2FA off.
export const requestEmailCode = () =>
  apiClient
    .post("/auth/2fa/email/code")
    .then((res) => parseBody(envelope(emailCodeSentSchema), res.data).data);

export const enableEmailTwoFactor = (code: string) =>
  apiClient
    .post("/auth/2fa/email/enable", { code })
    .then((res) => parseBody(messageOnly, res.data).message);

// Admins can't turn 2FA off (the API answers 403).
export const disableTwoFactor = (password: string, code: string) =>
  apiClient
    .post("/auth/2fa/disable", { password, code })
    .then((res) => parseBody(messageOnly, res.data).message);

// Needs a code from the authenticator app; old codes stop working.
export const regenerateRecoveryCodes = (code: string) =>
  apiClient
    .post("/auth/2fa/recovery-codes", { code })
    .then((res) => parseBody(envelope(recoveryCodesSchema), res.data).data);

