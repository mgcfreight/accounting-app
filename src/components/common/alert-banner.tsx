import { ReactNode } from "react";
import { AlertIcon } from "../icons";

// mokal-app's yellow AlertBanner, with an optional action slot instead of its
// fixed Dismiss / View buttons.
export default function AlertBanner({
  message,
  action,
}: {
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap md:flex-nowrap justify-between gap-3 p-4 rounded-lg items-center bg-base-alert border-[#F9C97C] border-1 w-full">
      <div className="flex md:items-center gap-2">
        <AlertIcon />
        <div className="text-medium w-full">
          <strong>ALERT :</strong> {message}
        </div>
      </div>
      {action}
    </div>
  );
}
