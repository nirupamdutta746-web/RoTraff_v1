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
    imageUrl: v.optional(v.string()),
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
      imageUrl: args.imageUrl,
      status: "active",
      reports: 1,
      reportedBy: user?.name || "Anonymous",
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Confirm / upvote an existing incident
// REWARD_THRESHOLD: credit the reporter with +5 ROTR after this many confirmations.
// Only signed-in (non-guest) users receive the reward.
const REWARD_THRESHOLD = 3;

export const confirm = mutation({
  args: { id: v.id("incidents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("You must be signed in to confirm an incident.");
    }

    // Block anonymous/guest users from verifying incidents
    const user = await ctx.db.get(userId);
    if (user?.isAnonymous) {
      throw new Error("Guest accounts cannot verify incidents. Please sign in with your email to verify.");
    }

    const incident = await ctx.db.get(args.id);
    if (!incident) {
      throw new Error("Incident not found.");
    }

    // Check if user already verified this incident
    const existingVerification = await ctx.db
      .query("incidentVerifications")
      .withIndex("by_user_incident", (q) =>
        q.eq("userId", userId).eq("incidentId", args.id),
      )
      .unique();

    if (existingVerification) {
      throw new Error("You can only verify an incident once.");
    }

    const now = Date.now();

    // Record the verification
    await ctx.db.insert("incidentVerifications", {
      userId,
      incidentId: args.id,
      createdAt: now,
    });

    const newCount = incident.reports + 1;

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

      // Only credit non-guest (signed-in) users
      const reporter = await ctx.db.get(incident.userId);
      if (reporter && !reporter.isAnonymous) {
        // Credit the original reporter with a reward (idempotent — won't double-pay)
        await ctx.runMutation(api.rewards.creditReport, {
          incidentId: args.id,
          userId: incident.userId,
        });
      }
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

// Admin: verify an incident
export const adminVerify = mutation({
  args: { id: v.id("incidents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Admin access required.");

    await ctx.db.patch(args.id, {
      status: "verified",
      verifiedBy: userId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// Admin: remove an incident from the map
export const adminRemove = mutation({
  args: { id: v.id("incidents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated.");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Admin access required.");

    await ctx.db.patch(args.id, {
      status: "resolved",
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// Admin: list ALL incidents including resolved
export const adminListAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("incidents").order("desc").collect();
  },
});

// Get incidents near a specific point (for route risk calculation)
export const listNearPoint = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusKm: v.number(),
  },
  handler: async (ctx, args) => {
    const latDeg = args.radiusKm / 111;
    const lngDeg = args.radiusKm / (111 * Math.cos((args.lat * Math.PI) / 180));
    const minLat = args.lat - latDeg;
    const maxLat = args.lat + latDeg;
    const minLng = args.lng - lngDeg;
    const maxLng = args.lng + lngDeg;

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
      (inc) => inc.lat >= minLat && inc.lat <= maxLat && inc.lng >= minLng && inc.lng <= maxLng,
    );
  },
});
