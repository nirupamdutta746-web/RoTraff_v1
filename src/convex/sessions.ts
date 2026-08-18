import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";

// Get all sessions for a user
export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get recent sessions for a user
export const listRecent = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

// Get all recent sessions (for the sessions page)
export const listAllRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

// Create a new session
export const create = mutation({
  args: {
    type: v.union(
      v.literal("route"),
      v.literal("report"),
      v.literal("activity"),
    ),
    title: v.string(),
    originLat: v.optional(v.number()),
    originLng: v.optional(v.number()),
    originName: v.optional(v.string()),
    destLat: v.optional(v.number()),
    destLng: v.optional(v.number()),
    destName: v.optional(v.string()),
    riskScore: v.optional(v.number()),
    travelTime: v.optional(v.string()),
    incidentsNearby: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to create a session.");
    }

    return await ctx.db.insert("sessions", {
      userId,
      type: args.type,
      title: args.title,
      originLat: args.originLat,
      originLng: args.originLng,
      originName: args.originName,
      destLat: args.destLat,
      destLng: args.destLng,
      destName: args.destName,
      riskScore: args.riskScore,
      travelTime: args.travelTime,
      incidentsNearby: args.incidentsNearby,
      createdAt: Date.now(),
    });
  },
});

// Delete a session
export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to delete sessions.");
    }

    const session = await ctx.db.get(args.id);
    if (!session) {
      throw new Error("Session not found.");
    }

    if (session.userId !== userId) {
      throw new Error("You can only delete your own sessions.");
    }

    await ctx.db.delete(args.id);
  },
});
