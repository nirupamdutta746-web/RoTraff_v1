import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  
  // Only query user if authenticated to avoid unnecessary query pending states
  const user = useQuery(api.users.currentUser, isAuthenticated ? undefined : "skip");
  const { signIn, signOut } = useAuthActions();

  // isLoading now strictly checks authentication state loading
  const isLoading = isAuthLoading;
  const isUserLoading = isAuthenticated && user === undefined;

  return {
    isLoading,
    isUserLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}