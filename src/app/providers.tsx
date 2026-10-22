import { HeroUIProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useHref, useNavigate } from "react-router";
import { Toaster } from "sonner";
import { UserProvider } from "@/components/providers/user-provider";
import { onSessionExpired, queryClient, signOut } from "@/services";

// Signing out drops every cached response too, so the next user to sign in
// in this tab never sees the last one's data.
const endSession = async () => {
  queryClient.clear();
  await signOut();
};

const onExpired = (listener: () => void) =>
  onSessionExpired(() => {
    queryClient.clear();
    listener();
  });

// Inside the router, so HeroUI components given an `href` navigate through
// React Router instead of reloading the page.
export default function Providers({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        <Toaster position="top-right" richColors />
        <UserProvider endSession={endSession} onSessionExpired={onExpired}>
          {children}
        </UserProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
