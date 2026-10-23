import { AxiosResponse } from "axios";
import { SignInStep, TwoFactorMethod } from "@/lib/enums";
import { User } from "@/lib/interfaces";
import { apiClient } from "./api-client";
import {
  isRecord,
  parseCount,
  parsePage,
  parseSession,
  parseStrings,
  parseTokens,
  parseUser,
  Parser,
  unwrap,
} from "./parse";
import { clearSession, setSessionTokens, Tokens } from "./session";

// Sign-in, sign-out and password reset (the API's /auth routes).
//
// Sign-in is one or two steps. POST /auth/login checks the password and
// either signs in or returns a challenge: TWO_FACTOR (enter a code) or
// TWO_FACTOR_SETUP (an Admin without 2FA must set it up first). The step
// that signs in stores the token pair here; callers get the user, never a
// token.

export type Credentials = { email: string; password: string };

export type SignInChallenge = {
  nextStep: SignInStep.TwoFactor | SignInStep.TwoFactorSetup;
  // Single-use proof that the password step passed; valid a few minutes.
  challengeToken: string;
  expiresAt: string;
  // What this user can use for the next step.
  methods: TwoFactorMethod[];
};

export type SignedIn = {
  nextStep: SignInStep.SignedIn;
  user: User;
  // Authenticator recovery codes left; absent after a password-only sign-in.
  recoveryCodesRemaining?: number;
  // New recovery codes, only right after setting up the authenticator app.
  // Shown once; the API never sends them again.
  recoveryCodes?: string[];
};

export type SignInResult = SignInChallenge | SignedIn;

export type ChallengeCode = { challengeToken: string; code: string };

export type EmailCodeSent = { sentTo: string; expiresAt: string };

export type AuthenticatorSetup = {
  // Base32, for typing into the app instead of scanning.
  secret: string;
  // A PNG data URL of the otpauth:// link, for an <img src>.
  qrCodeDataUrl: string;
};

const isTwoFactorMethod = (value: unknown): value is TwoFactorMethod =>
  Object.values(TwoFactorMethod).includes(value as TwoFactorMethod);

const parseChallenge: Parser<SignInChallenge> = (value) => {
  if (!isRecord(value)) return null;
  const { nextStep, challengeToken, expiresAt, methods } = value;
  if (
    (nextStep !== SignInStep.TwoFactor &&
      nextStep !== SignInStep.TwoFactorSetup) ||
    typeof challengeToken !== "string" ||
    typeof expiresAt !== "string" ||
    !Array.isArray(methods) ||
    !methods.every(isTwoFactorMethod)
  ) {
    return null;
  }
  return { nextStep, challengeToken, expiresAt, methods };
};

type SignedInBody = Omit<SignedIn, "nextStep"> & { tokens: Tokens };

const parseSignedIn: Parser<SignedInBody> = (value) => {
  if (!isRecord(value)) return null;
  const user = parseUser(value.user);
  const tokens = parseTokens(value.tokens);
  const remaining =
    value.recoveryCodesRemaining === undefined
      ? undefined
      : parseCount(value.recoveryCodesRemaining);
  const recoveryCodes =
    value.recoveryCodes === undefined
      ? undefined
      : parseStrings(value.recoveryCodes);
  if (!user || !tokens || remaining === null || recoveryCodes === null) {
    return null;
  }
  return {
    user,
    tokens,
    ...(remaining !== undefined && { recoveryCodesRemaining: remaining }),
    ...(recoveryCodes !== undefined && { recoveryCodes }),
  };
};

const startSession = ({ tokens, ...rest }: SignedInBody): SignedIn => {
  setSessionTokens(tokens);
  return { nextStep: SignInStep.SignedIn, ...rest };
};

const parseLogin: Parser<SignInChallenge | SignedInBody> = (value) =>
  isRecord(value) && value.nextStep === SignInStep.SignedIn
    ? parseSignedIn(value)
    : parseChallenge(value);

// Step 1: email and password.
export const signIn = async (
  credentials: Credentials
): Promise<SignInResult> => {
  const result = unwrap(
    await apiClient.post("/auth/login", credentials),
    parseLogin
  );
  return "tokens" in result ? startSession(result) : result;
};

// Step 2: a code from the authenticator app, or a recovery code.
export const verifyTwoFactorCode = async (body: ChallengeCode) =>
  startSession(
    unwrap(await apiClient.post("/auth/2fa/verify", body), parseSignedIn)
  );

const parseEmailCodeSent: Parser<EmailCodeSent> = (value) =>
  isRecord(value) &&
  typeof value.sentTo === "string" &&
  typeof value.expiresAt === "string"
    ? { sentTo: value.sentTo, expiresAt: value.expiresAt }
    : null;

// Step 2 by email: send a code. At most one a minute.
export const sendSignInEmailCode = async (challengeToken: string) =>
  unwrap(
    await apiClient.post("/auth/2fa/email/send", { challengeToken }),
    parseEmailCodeSent
  );

// Step 2 by email: the code. For an Admin without 2FA it also turns 2FA on.
export const verifySignInEmailCode = async (body: ChallengeCode) =>
  startSession(
    unwrap(await apiClient.post("/auth/2fa/email/verify", body), parseSignedIn)
  );

// Only a PNG data URL may become an <img src> (security.md).
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;

const parseAuthenticatorSetup: Parser<AuthenticatorSetup> = (value) =>
  isRecord(value) &&
  typeof value.secret === "string" &&
  typeof value.qrCodeDataUrl === "string" &&
  PNG_DATA_URL.test(value.qrCodeDataUrl)
    ? { secret: value.secret, qrCodeDataUrl: value.qrCodeDataUrl }
    : null;

// Admin setup at sign-in: a new authenticator secret. Calling it again
// replaces the secret.
export const startAuthenticatorSetup = async (challengeToken: string) =>
  unwrap(
    await apiClient.post("/auth/2fa/setup", { challengeToken }),
    parseAuthenticatorSetup
  );

// Admin setup at sign-in: a code from the new app turns 2FA on and signs in.
// The result carries the recovery codes, this one time only.
export const enableAuthenticator = async (body: ChallengeCode) =>
  startSession(
    unwrap(await apiClient.post("/auth/2fa/enable", body), parseSignedIn)
  );

// The signed-in user; a 401 means nobody is signed in.
export const getMe = async (signal?: AbortSignal) =>
  unwrap(await apiClient.get("/auth/me", { signal }), parseUser);

// Ends the session on the API, then forgets the tokens even if that failed:
// the user asked to be signed out of this browser.
export const signOut = async () => {
  try {
    await apiClient.post("/auth/logout");
  } finally {
    clearSession();
  }
};

// Always answers the same way, whether or not the email has an account.
export const requestPasswordReset = async (email: string) => {
  await apiClient.post("/auth/forgot-password", { email });
};

// From the emailed link. Signs the user out everywhere.
export const resetPassword = async (body: {
  token: string;
  password: string;
}) => {
  await apiClient.post("/auth/reset-password", body);
};

// ------------------------------------------------- the signed-in user's own
// account (profile). No screen uses these yet.

const parseRecoveryCodes: Parser<string[]> = (value) =>
  isRecord(value) ? parseStrings(value.recoveryCodes) : null;

// The API signs out every other session and sends a fresh pair for this one.
const keepSession = (res: AxiosResponse) => {
  setSessionTokens(
    unwrap(res, (data) => (isRecord(data) ? parseTokens(data.tokens) : null))
  );
};

// Your sign-in history, newest first; `isCurrent` marks this one.
export const getMySessions = async (
  query: { page: number; limit: number },
  signal?: AbortSignal
) =>
  unwrap(
    await apiClient.get("/auth/sessions", { params: query, signal }),
    parsePage(parseSession)
  );

// Signs out your other sessions.
export const changePassword = async (body: {
  currentPassword: string;
  newPassword: string;
}) => {
  keepSession(await apiClient.put("/auth/change-password", body));
};

// Starts setting up an authenticator app. Calling it again replaces an
// unfinished setup.
export const startProfileAuthenticatorSetup = async () =>
  unwrap(
    await apiClient.post("/auth/2fa/authenticator/setup"),
    parseAuthenticatorSetup
  );

// A code from the new app turns 2FA on. Returns the recovery codes, shown
// this one time only.
export const enableProfileAuthenticator = async (code: string) =>
  unwrap(
    await apiClient.post("/auth/2fa/authenticator/enable", { code }),
    parseRecoveryCodes
  );

// Emails you a code: to turn email 2FA on, or to confirm turning 2FA off.
export const sendProfileEmailCode = async () =>
  unwrap(await apiClient.post("/auth/2fa/email/code"), parseEmailCodeSent);

export const enableEmailTwoFactor = async (code: string) => {
  await apiClient.post("/auth/2fa/email/enable", { code });
};

// Password and a current code (app, recovery or emailed). Not allowed for
// Admins. Signs out your other sessions.
export const disableTwoFactor = async (body: {
  password: string;
  code: string;
}) => {
  keepSession(await apiClient.post("/auth/2fa/disable", body));
};

// Replaces your recovery codes; confirmed with a current app code. Returns
// the new ones, shown this one time only.
export const regenerateRecoveryCodes = async (code: string) =>
  unwrap(
    await apiClient.post("/auth/2fa/recovery-codes", { code }),
    parseRecoveryCodes
  );

export type TwoFactorOptions = {
  // An authenticator app is set up (app and recovery codes work).
  authenticatorSetUp: boolean;
  // False for Admins: they must keep 2FA on.
  canTurnOff: boolean;
  // What this server offers.
  availableMethods: TwoFactorMethod[];
};

export type MyAccount = {
  user: User;
  recoveryCodesRemaining: number;
  twoFactor: TwoFactorOptions;
};

const parseMyAccount: Parser<MyAccount> = (value) => {
  const user = parseUser(value);
  if (!user || !isRecord(value) || !isRecord(value.twoFactor)) return null;
  const remaining = parseCount(value.recoveryCodesRemaining);
  const { authenticatorSetUp, canTurnOff, availableMethods } = value.twoFactor;
  if (
    remaining === null ||
    typeof authenticatorSetUp !== "boolean" ||
    typeof canTurnOff !== "boolean" ||
    !Array.isArray(availableMethods) ||
    !availableMethods.every(isTwoFactorMethod)
  ) {
    return null;
  }
  return {
    user,
    recoveryCodesRemaining: remaining,
    twoFactor: { authenticatorSetUp, canTurnOff, availableMethods },
  };
};

// The signed-in user with their 2FA options, for the profile page.
export const getMyAccount = async (signal?: AbortSignal) =>
  unwrap(await apiClient.get("/auth/me", { signal }), parseMyAccount);
