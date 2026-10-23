import { toast } from "sonner";
import BaseButton from "./base-button";

// One-time two-factor recovery codes. The API shows them once only, so the
// list offers copy and download before the user moves on.
export default function RecoveryCodes({ codes }: { codes: string[] }) {
  const text = codes.join("\n");

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([`${text}\n`], { type: "text/plain" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "mgc-accounts-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        Save these recovery codes somewhere safe. Each one signs you in once if
        you lose your phone. <strong>They won&apos;t be shown again.</strong>
      </p>
      <ul className="grid grid-cols-2 gap-2 bg-content-2 rounded-lg p-4 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-3">
        <BaseButton
          text="Copy"
          varient="bordered"
          className="text-base-primary px-6"
          onPress={() =>
            navigator.clipboard
              .writeText(text)
              .then(() => toast.success("Recovery codes copied."))
              .catch(() => toast.error("Couldn't copy. Download them instead."))
          }
        />
        <BaseButton
          text="Download"
          varient="bordered"
          className="text-base-primary px-6"
          onPress={download}
        />
      </div>
    </div>
  );
}
