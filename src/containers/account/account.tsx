import { Link } from "react-router";
import { BaseCardWrapper, DetailRow } from "@/components/common";
import { useCurrentUser } from "@/components/providers/user-provider";
import { formatDateTime, fullName } from "@/lib/utils";
import ChangePassword from "./change-password";
import TwoFactorSettings from "./two-factor-settings";

// The signed-in user's own account: who they are, their password, their
// two-factor sign-in, and a link to their sessions. Name, email and role are
// changed by an Admin on the Users page.
export default function Account() {
  const me = useCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <BaseCardWrapper
        heading="Profile"
        action={
          <Link
            to="/users/sessions/"
            className="text-sm text-base-primary-300 hover:underline"
          >
            View my sessions
          </Link>
        }
      >
        <div className="flex flex-col gap-3 max-w-xl">
          <DetailRow label="Name" value={fullName(me)} />
          <DetailRow label="Email" value={me.email} />
          <DetailRow label="Role" value={me.role.name} />
          <DetailRow
            label="Last sign-in"
            value={formatDateTime(me.lastLoginAt ?? undefined) ?? "—"}
          />
        </div>
      </BaseCardWrapper>
      <ChangePassword />
      <TwoFactorSettings />
    </div>
  );
}
