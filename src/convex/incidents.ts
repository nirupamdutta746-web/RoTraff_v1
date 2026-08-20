import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";

// Get all visible incidents (active + verified + permanent)
export const list = query({
  args: {},
  handler: async (ctx) => {
    const active = await ctx.db
      .query("incidents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();
    const verified = await ctx.db
      .query("incidents")
      .withIndex("by_status", (q) => q.eq("status", "verified"))
      .order("desc")
      .collect();
    const permanent = await ctx.db
      .query("incidents")
      .withIndex("by_status", (q) => q.eq("status", "permanent"))
      .order("desc")
      .collect();
    return [...active, ...verified, ...permanent];
  },
});

// Get incidents by type
export const listByType = query({
  args: { type: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("incidents")
      .withIndex("by_type", (q) => q.eq("type", args.type as any))
      .order("desc")
      .collect();
  },
});

// Get incidents near a location (bounding box)
export const listNearby = query({
  args: {
    minLat: v.number(),
    maxLat: v.number(),
    minLng: v.number(),
    maxLng: v.number(),
  },
  handler: async (ctx, args) => {
    const active = await ctx.db
      .query("incidents")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const verified = await ctx.db
      .query("incidents")
      .withIndex("by_status", (q) => q.eq("status", "verified"))
      .collect();
    const permanent = await ctx.db
      .query("incidents")
      .withIndex("by_status", (q) => q.eq("status", "permanent"))
      .collect();
    const allIncidents = [...active, ...verified, ...permanent];

    return allIncidents.filter(
      (incident) =>
        incident.lat >= args.minLat &&
        incident.lat <= args.maxLat &&
        incident.lng >= args.minLng &&
        incident.lng <= args.maxLng,
    );
  },
});

// Get incidents by a specific user
export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("incidents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get a single incident by ID
export const get = query({
  args: { id: v.id("incidents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Report a new incident
export const report = mutation({
  args: {
    type: v.string(),
    severity: v.string(),
    lat: v.number(),
    lng: v.number(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("You must be signed in to report an incident.");
    }

    const user = await ctx.db.get(userId);

    return await ctx.db.insert("incidents", {
      userId,
      type: args.type as any,
      severity: args.severity as any,
      lat: args.lat,
      lng: args.lng,
      description: args.description,
      status: "active",
      reports: 1,
      reportedBy: user?.name || "Anonymous",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Confirm / upvote an existing incident
// REWARD_THRESHOLD: credit the reporter after this many confirmations.
// PERMANENT_THRESHOLD: mark the incident as "permanent" on the map.
const REWARD_THRESHOLD = 3;
const PERMANENT_THRESHOLD = 10;

export const confirm = mutation({
  args: { id: v.id("incidents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to confirm an incident.");
    }

    const incident = await ctx.db.get(args.id);
    if (!incident) {
      throw new Error("Incident not found.");
    }

    const newCount = incident.reports + 1;
    const now = Date.now();

    await ctx.db.patch(args.id, {
      reports: newCount,
      updatedAt: now,
    });

    // Credit the reporter with a reward once the reward threshold is crossed
    if (
      newCount >= REWARD_THRESHOLD &&
      incident.status === "active"
    ) {
      await ctx.db.patch(args.id, {
        status: "verified",
        updatedAt: now,
      });

      // Credit the original reporter with a reward (idempotent — won't double-pay)
      await ctx.runMutation(api.rewards.creditReport, {
        incidentId: args.id,
        userId: incident.userId,
      });
    }

    // Mark as permanent on the map after many verifications
    if (
      newCount >= PERMANENT_THRESHOLD &&
      incident.status !== "permanent"
    ) {
      await ctx.db.patch(args.id, {
        status: "permanent",
        updatedAt: now,
      });
    }
  },
});

// Update incident status
export const updateStatus = mutation({
  args: {
    id: v.id("incidents"),
    status: v.union(
      v.literal("active"),
      v.literal("resolved"),
      v.literal("verified"),
      v.literal("permanent"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to update incidents.");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

// Delete an incident (only by the reporter or admin)
export const remove = mutation({
  args: { id: v.id("incidents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to delete incidents.");
    }

    const incident = await ctx.db.get(args.id);
    if (!incident) {
      throw new Error("Incident not found.");
    }

    const user = await ctx.db.get(userId);
    if (incident.userId !== userId && user?.role !== "admin") {
      throw new Error("You can only delete your own incidents.");
    }

    await ctx.db.delete(args.id);
  },
});
