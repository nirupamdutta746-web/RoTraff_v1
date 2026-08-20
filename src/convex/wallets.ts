import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";

/**
 * Wallet queries and mutations.
 *
 * Security: stellarSecretKeyEncrypted is NEVER returned by any query.
 * We project it out explicitly by returning only the fields the client needs.
 */

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Get current user's wallet info.
 * Returns { publicKey, balance, provisioned } or null if no wallet yet.
 */
export const getWallet = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!wallet) return null;

    return {
      publicKey: wallet.stellarPublicKey,
      provisioned: wallet.status === "active",
      provisionedAt: wallet.provisionedAt,
    };
  },
});

/**
 * Get wallet info for any user (used internally by reward logic).
 * Only returns the public key — never the encrypted secret.
 */
export const getWalletByUser = query({
  args: { userId: v.id("users") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!wallet) return null;

    return {
      userId: wallet.userId,
      publicKey: wallet.stellarPublicKey,
      status: wallet.status,
    };
  },
});

// ── Mutations ────────────────────────────────────────────────────────────

/**
 * Provision a Stellar wallet for the current user.
 * Idempotent: checks for existing wallet before creating.
 * Calls Friendbot + ChangeTrust internally via Stellar service.
 */
export const provision = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Idempotent — don't double-provision
    const existing = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      return { alreadyProvisioned: true, publicKey: existing.stellarPublicKey };
    }

    // Import Stellar service (only runs server-side in Convex)
    const { provisionWallet } = await import("../lib/stellar");
    const result = await provisionWallet();

    await ctx.db.insert("wallets", {
      userId,
      stellarPublicKey: result.publicKey,
      stellarSecretKeyEncrypted: result.secretKeyEncrypted,
      provisionedAt: Date.now(),
      status: "active",
    });

    return { alreadyProvisioned: false, publicKey: result.publicKey };
  },
});


