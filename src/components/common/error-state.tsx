import { Warning2 } from "../icons";
import BaseButton from "./base-button";

// mokal-app's ErrorState, also used for "not found" on the detail pages.
export default function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this. Please try again.",
  actionText = "Retry",
  onAction,
}: {
  title?: string;
  message?: string;
  actionText?: string;
  onAction?: () => void;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4 py-20 text-center">
      <Warning2 />
      <div>
        <h2 className="text-lg font-medium text-base-primary-300">{title}</h2>
        <p className="text-sm text-base-primary mt-1">{message}</p>
      </div>
      {onAction && <BaseButton text={actionText} onPress={onAction} />}
    </div>
  );
}
