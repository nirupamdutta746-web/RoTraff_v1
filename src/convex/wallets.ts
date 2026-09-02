import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { getAssetInfo as getStellarAssetInfo } from "../lib/stellar";
import type { AssetInfo } from "../lib/stellar";

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

// ── Asset Info ────────────────────────────────────────────────────────────

/**
 * Get the ROTR asset metadata including the Soroban contract ID
 * and issuing account public key.
 */
export const getAssetInfo = query({
  args: {},
  handler: async () => {
    return getStellarAssetInfo();
  },
});

// ── Mutations ────────────────────────────────────────────────────────────

/**
 * Provision a Stellar wallet for the current user.
 * Idempotent: checks for existing wallet before creating.
 * Calls Friendbot internally via Stellar service (no trustline needed).
 */
/**
 * Provision a Stellar wallet for the current user.
 * Schedules the actual provisioning as an action (fetch only runs in actions).
 * No trustline needed — token balances are managed by the Soroban contract.
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

    // Schedule the action that does the actual Stellar provisioning
    await ctx.scheduler.runAfter(0, api.walletActions.provisionWalletAction, {
      userId,
    });

    return { alreadyProvisioned: false, publicKey: "pending" };
  },
});

// ── Action (runs fetch) ───────────────────────────────────────────────────

/**
 * Save a provisioned wallet to the database (called from walletActions).
 * Secret key is AES-256-GCM encrypted — never returned by queries.
 */
export const saveWallet = mutation({
  args: {
    userId: v.id("users"),
    publicKey: v.string(),
    secretKeyEncrypted: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) return; // already saved

    await ctx.db.insert("wallets", {
      userId: args.userId,
      stellarPublicKey: args.publicKey,
      stellarSecretKeyEncrypted: args.secretKeyEncrypted,
      provisionedAt: Date.now(),
      status: "active",
    });
  },
});


