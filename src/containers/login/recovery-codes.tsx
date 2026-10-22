import { toast } from "sonner";
import { BaseButton } from "@/components/common";

// The recovery codes from setting up an authenticator app. The API sends
// them once and never again, so the user confirms they've kept them before
// going on.
export default function RecoveryCodes({
  codes,
  onContinue,
}: {
  codes: string[];
  onContinue: () => void;
}) {
  const copy = () =>
    navigator.clipboard
      .writeText(codes.join("\n"))
      .then(() => toast.success("Recovery codes copied."))
      .catch(() => toast.error("Couldn't copy. Write the codes down instead."));

  return (
    <>
      <h2 className="text-xl font-bold mb-2">Save your recovery codes</h2>
      <p className="text-sm mb-4">
        Each code signs you in once if you lose your authenticator app. Keep
        them somewhere safe — they won&apos;t be shown again.
      </p>
      <ul className="grid grid-cols-2 gap-2 mb-4 p-4 rounded-lg bg-content-3 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <BaseButton
        text="Copy Codes"
        varient="bordered"
        className="w-full text-base-primary mb-3"
        onPress={copy}
      />
      <BaseButton
        text="I've Saved Them — Continue"
        className="w-full"
        onPress={onContinue}
      />
    </>
  );
}
