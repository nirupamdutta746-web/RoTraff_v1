import { api } from "@/convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.getCurrentUser);

  // Provide safe defaults for signIn/signOut when auth actions aren't available
  const signIn = async () => {
    window.location.href = "/auth";
  };
  const signOut = async () => {
    window.location.href = "/auth";
  };

  const isLoading = isAuthLoading || user === undefined;

  return {
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
