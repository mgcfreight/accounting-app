import { Link } from "react-router";
import { BaseButton, StatusChip } from "@/components/common";
import { useCurrentUser } from "@/components/providers/user-provider";
import { createInitials, formatDateTime, fullName } from "@/lib/utils";
import ChangePassword from "./change-password";
import TwoFactorSettings from "./two-factor-settings";

// The signed-in user's own account: who they are, their password, their
// two-factor sign-in, and a link to their sessions. Name, email and role are
// changed by an Admin on the Users page.
export default function Account() {
  const me = useCurrentUser();
  const name = fullName(me);

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Profile"
        className="flex flex-col gap-4 rounded-lg bg-white p-4 shadow-md sm:flex-row sm:items-center"
      >
        <div
          aria-hidden
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-base-primary-500 text-lg font-semibold uppercase text-white"
        >
          {createInitials(name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-semibold text-base-primary-900">{name}</h2>
          <p className="flex flex-wrap items-center gap-2 text-sm text-content-6">
            <span className="break-all">{me.email}</span>
            <StatusChip text={me.role.name} tone="secondary" />
          </p>
          <p className="text-xs text-content-5">
            Last sign-in: {formatDateTime(me.lastLoginAt ?? undefined) ?? "—"}
          </p>
          <p className="text-xs text-content-5">
            Your name, email and role are changed by an Admin.
          </p>
        </div>
        <BaseButton
          as={Link}
          to="/users/sessions/"
          text="View My Sessions"
          varient="bordered"
          className="w-full rounded-xl px-4 text-base-primary sm:w-auto"
        />
      </section>

      <ChangePassword />
      <TwoFactorSettings />
    </div>
  );
}
