import { HeroUIProvider } from "@heroui/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useHref, useNavigate } from "react-router";
import { Toaster } from "sonner";
import { UserProvider } from "@/components/providers/user-provider";
import { queryClient } from "@/services";

// Inside the router, so HeroUI components given an `href` navigate through
// React Router instead of reloading the page.
export default function Providers({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={navigate} useHref={useHref}>
        <Toaster position="top-right" richColors />
        <UserProvider>{children}</UserProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
