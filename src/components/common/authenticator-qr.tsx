// The QR code and secret for adding MGC Accounts to an authenticator app.
// `qrCodeDataUrl` is checked to be a PNG data URL before it gets here
// (services/schemas.ts), so it is safe as an <img src>.
export default function AuthenticatorQr({
  qrCodeDataUrl,
  secret,
}: {
  qrCodeDataUrl: string;
  secret: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-center">
        Scan this code with an authenticator app (Google Authenticator,
        Microsoft Authenticator, 1Password…), then enter the 6-digit code it
        shows.
      </p>
      <img
        src={qrCodeDataUrl}
        alt="QR code for your authenticator app"
        className="w-44 h-44"
      />
      <p className="text-xs text-content-5 text-center">
        Can&apos;t scan it? Enter this key instead:
        <br />
        <span className="font-mono break-all select-all">{secret}</span>
      </p>
    </div>
  );
}
