import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, QueryCtx } from "./_generated/server";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

// Update the current user's display name
export const updateName = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update your name.");
    }
    const trimmed = args.name.trim();
    if (!trimmed || trimmed.length > 100) {
      throw new Error("Name must be between 1 and 100 characters.");
    }
    await ctx.db.patch(userId, { name: trimmed });
    return { success: true };
  },
});

// Clear all sessions for the current user
export const clearAllSessions = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to clear sessions.");
    }
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }
    return { deleted: sessions.length };
  },
});

// Delete the current user's account and all associated data
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to delete your account.");
    }
    // Delete all user's sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }
    // Delete all user's incidents
    const incidents = await ctx.db
      .query("incidents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const inc of incidents) {
      await ctx.db.delete(inc._id);
    }
    // Delete the user record
    await ctx.db.delete(userId);
    return { success: true };
  },
});
