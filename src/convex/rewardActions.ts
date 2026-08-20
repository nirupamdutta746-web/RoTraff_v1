import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Process a single pending reward by sending Stellar payment.
 * Called via scheduler after creditReport writes the pending row.
 * On failure: marks the row as "failed" (does NOT throw — failure should not crash anything).
 */
export const processPendingReward = action({
  args: { rewardTransactionId: v.id("rewardTransactions") },
  handler: async (ctx, args) => {
    const rewardRow = await ctx.runQuery(api.rewards.getTransactionById, {
      transactionId: args.rewardTransactionId,
    });
    if (!rewardRow || rewardRow.status !== "pending") return;

    // Stop retrying after 3 attempts to prevent infinite loops
    if ((rewardRow.retryCount ?? 0) >= 3) {
      await ctx.runMutation(api.rewards.updateRewardStatus, {
        transactionId: args.rewardTransactionId,
        status: "failed",
      });
      return;
    }

    const wallet = await ctx.runQuery(api.wallets.getWalletByUser, {
      userId: rewardRow.userId,
    });
    if (!wallet || wallet.status !== "active") {
      await ctx.runMutation(api.rewards.updateRewardStatus, {
        transactionId: args.rewardTransactionId,
        status: "failed",
      });
      return;
    }

    try {
      const { sendRewardPayment } = await import("../lib/stellar");
      const result = await sendRewardPayment(
        wallet.publicKey,
        rewardRow.amount,
      );

      await ctx.runMutation(api.rewards.confirmReward, {
        transactionId: args.rewardTransactionId,
        stellarTransactionHash: result.hash,
      });
    } catch (error) {
      console.error(
        `[Reward] Stellar payment failed for tx ${args.rewardTransactionId}:`,
        error,
      );
      await ctx.runMutation(api.rewards.updateRewardStatus, {
        transactionId: args.rewardTransactionId,
        status: "failed",
      });
    }
  },
});

/**
 * Process ALL pending rewards in a batch (for scheduled cron / retry).
 * Useful if multiple rewards are stuck in "pending" state.
 */
export const processAllPending = action({
  args: {},
  returns: v.any(),
  handler: async (ctx): Promise<{ scheduled: number }> => {
    const pending = await ctx.runQuery(api.rewards.getPendingTransactions);

    for (const txn of pending) {
      await ctx.scheduler.runAfter(0, api.rewardActions.processPendingReward, {
        rewardTransactionId: txn._id,
      });
    }

    return { scheduled: pending.length };
  },
});
