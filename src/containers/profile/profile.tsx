import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  BaseCardWrapper,
  ErrorState,
  InfoStrip,
  StatusChip,
  TableSkeleton,
} from "@/components/common";
import { useUser } from "@/components/providers/user-provider";
import { formatDateTime, fullName, humanize } from "@/lib/utils";
import { errorMessage, getMyAccount, getMySessions } from "@/services";
import ChangePasswordCard from "./change-password-card";
import SessionsTable from "./sessions-table";
import TwoFactorCard from "./two-factor-card";

// Your own account: who you are, your password, two-step verification and
// where you've signed in from. Every signed-in user has one.
export default function Profile() {
  const { setUser } = useUser();
  const account = useQuery({
    queryKey: ["me"],
    queryFn: ({ signal }) => getMyAccount(signal),
  });

  // Keep the header (and anything else reading the user) in step after a
  // change here, such as turning 2FA on.
  useEffect(() => {
    if (account.data) setUser(account.data.user);
  }, [account.data, setUser]);

  if (account.isPending) return <TableSkeleton />;
  if (account.isError) {
    return (
      <ErrorState
        message={errorMessage(account.error)}
        onAction={() => void account.refetch()}
      />
    );
  }

  const { user } = account.data;

  return (
    <div className="grid grid-cols-1 gap-6 mb-5">
      <InfoStrip
        items={[
          { label: "Name", value: fullName(user) },
          { label: "Email", value: user.email },
          { label: "Role", value: humanize(user.role) },
          {
            label: "Two-Step",
            value: user.twoFactorEnabled ? (
              <StatusChip text="On" tone="success" />
            ) : (
              <StatusChip text="Off" tone="warning" />
            ),
          },
          {
            label: "Last Sign-in",
            value: formatDateTime(user.lastLoginAt ?? undefined) ?? "—",
          },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChangePasswordCard />
        <TwoFactorCard
          account={account.data}
          onChanged={() => void account.refetch()}
        />
      </div>
      <BaseCardWrapper heading="Sign-in History">
        <SessionsTable queryKey={["me", "sessions"]} fetchPage={getMySessions} />
      </BaseCardWrapper>
    </div>
  );
}
