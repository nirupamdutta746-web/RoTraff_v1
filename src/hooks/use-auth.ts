import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);

  // Try to get auth actions from Convex Auth provider
  // Falls back to redirect-based auth if provider isn't set up
  let signIn: (...args: any[]) => Promise<any> = async (..._args: any[]) => {
    window.location.href = "/auth";
  };
  let signOut: () => Promise<any> = async () => {
    window.location.href = "/";
  };

  try {
    // Import dynamically to avoid crashing if @convex-dev/auth/react isn't fully set up
    const authModule = import.meta.glob("@convex-dev/auth/react", { eager: true }) as any;
    if (authModule && authModule.useAuthActions) {
      const actions = authModule.useAuthActions();
      if (actions?.signIn) signIn = actions.signIn;
      if (actions?.signOut) signOut = actions.signOut;
    }
  } catch {
    // Auth actions not available — use redirect fallback
  }

  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
