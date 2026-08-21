"use node";

import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { provisionWallet, getRotBalance } from "../lib/stellar";

/**
 * Provision a Stellar wallet for a user.
 * This is an action because it uses fetch() (Friendbot + Horizon).
 * Called via scheduler from the wallets.provision mutation.
 */
export const provisionWalletAction = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    try {
      const result = await provisionWallet();

      // Save to database via mutation
      await ctx.runMutation(api.wallets.saveWallet, {
        userId: args.userId,
        publicKey: result.publicKey,
        secretKeyEncrypted: result.secretKeyEncrypted,
      });
    } catch (error) {
      console.error("[Wallet] Provisioning failed:", error);
    }
  },
});

/**
 * Fetch the user's live ROTR balance from Stellar Horizon.
 * Returns the on-chain balance rather than the local ledger sum.
 */
export const getLiveBalance = action({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const wallet = await ctx.runQuery(api.wallets.getWalletByUser, {
      userId,
    });
    if (!wallet || wallet.status !== "active") return 0;

    try {
      const info = await getRotBalance(wallet.publicKey);
      return parseFloat(info.balance);
    } catch {
      return 0;
    }
  },
});
