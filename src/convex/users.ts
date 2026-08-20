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

// Set user role (admin only)
export const setRole = mutation({
  args: { userId: v.id("users"), role: v.union(v.literal("admin"), v.literal("user"), v.literal("member")) },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Not authenticated.");
    const caller = await ctx.db.get(callerId);
    if (caller?.role !== "admin") throw new Error("Admin access required.");
    await ctx.db.patch(args.userId, { role: args.role });
    return { success: true };
  },
});

// Ensure current user has a role (assigns 'user' if none exists)
// Called after login to guarantee every user has a role.
export const ensureRole = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found.");
    if (!user.role) {
      await ctx.db.patch(userId, { role: "user" });
    }
    return { role: user.role || "user" };
  },
});

// Check if current user is admin
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    return user?.role === "admin";
  },
});

// List all users (admin only)
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return [];
    return await ctx.db.query("users").collect();
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

// Delete any user and all associated data (admin only)
export const adminDeleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const callerId = await getAuthUserId(ctx);
    if (!callerId) throw new Error("Not authenticated.");
    const caller = await ctx.db.get(callerId);
    if (caller?.role !== "admin") throw new Error("Admin access required.");
    if (args.userId === callerId) throw new Error("Admin cannot delete their own account.");

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("User not found.");

    // Delete all user's sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const s of sessions) {
      await ctx.db.delete(s._id);
    }

    // Delete all user's incidents
    const incidents = await ctx.db
      .query("incidents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const inc of incidents) {
      await ctx.db.delete(inc._id);
    }

    // Delete the user record
    await ctx.db.delete(args.userId);
    return { success: true };
  },
});
