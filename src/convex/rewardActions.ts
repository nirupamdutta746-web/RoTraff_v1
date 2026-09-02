"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { sendRewardPayment, findRealTxHashes } from "../lib/stellar";

/**
 * Process a single pending reward by calling the Soroban ROTR contract.
 * Called via scheduler after creditReport writes the pending row.
 * On failure: marks the row as failed (does NOT throw — failure should not crash anything).
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
      // Wallet may still be provisioning (race with provisionWalletAction).
      // Retry later instead of immediately failing — but only while under the retry cap.
      const retries = (rewardRow.retryCount ?? 0);
      if (retries >= 3) {
        // Already exhausted retries — fail permanently
        await ctx.runMutation(api.rewards.updateRewardStatus, {
          transactionId: args.rewardTransactionId,
          status: "failed",
        });
        return;
      }
      // Increment retryCount and reschedule for later
      await ctx.runMutation(api.rewards.updateRewardStatus, {
        transactionId: args.rewardTransactionId,
        status: "pending",
      });
      await ctx.scheduler.runAfter(10_000, api.rewardActions.processPendingReward, {
        rewardTransactionId: args.rewardTransactionId,
      });
      return;
    }

    try {
      const result = await sendRewardPayment(
        wallet.publicKey,
        rewardRow.incidentId ? parseInt(String(rewardRow.incidentId).replace(/[^0-9]/g, "").slice(0, 15) || "0", 10) : 0,
      );

      await ctx.runMutation(api.rewards.confirmReward, {
        transactionId: args.rewardTransactionId,
        stellarTransactionHash: result.hash,
      });
    } catch (error) {
      console.error(
        `[Reward] Soroban contract call failed for tx ${args.rewardTransactionId}:`,
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

/**
 * Backfill: replace old hardcoded "contract_invoked" hashes with real
 * on-chain transaction hashes by querying Horizon for admin-signed
 * Soroban transactions and matching by recipient + incident ID.
 *
 * Run once via Convex dashboard → Functions → rewardActions.backfillTransactionHashes
 * Safe to run multiple times — only touches records with the fake hash.
 */
export const backfillTransactionHashes = action({
  args: {},
  returns: v.object({
    message: v.string(),
    updated: v.number(),
    notFound: v.number(),
    total: v.number(),
  }),
  handler: async (ctx) => {
    // 1. Get all confirmed records with the old fake hash
    const fakeRecords: Array<{
      _id: string;
      userId: string;
      incidentId: string | undefined;
      amount: number;
      reason: string;
      createdAt: number;
    }> = await ctx.runQuery(api.rewards.getConfirmedWithFakeHash);
    if (fakeRecords.length === 0) {
      return { message: "No records to backfill", updated: 0, notFound: 0, total: 0 };
    }

    console.log(`[Backfill] Found ${fakeRecords.length} records with fake hash`);

    // 2. Query Horizon for real transaction hashes
    const realHashes = await findRealTxHashes();
    console.log(`[Backfill] Found ${realHashes.length} on-chain reward transactions`);

    // 3. Build a lookup: (userPublicKey, incidentId) → realHash
    const hashLookup = new Map<string, string>();
    for (const match of realHashes) {
      const key = `${match.userPublicKey}:${match.incidentId}`;
      hashLookup.set(key, match.realHash);
    }

    // 4. Match and update
    let updated = 0;
    let notFound = 0;
    for (const record of fakeRecords) {
      if (!record.incidentId) {
        notFound++;
        continue;
      }

      // Look up the user's wallet to get their public key
      const wallet: { publicKey: string } | null = await ctx.runQuery(api.wallets.getWalletByUser, {
        userId: record.userId as any,
      });
      if (!wallet) {
        notFound++;
        continue;
      }

      // Parse incidentId the same way processPendingReward does
      const incidentIdNum = parseInt(
        String(record.incidentId).replace(/[^0-9]/g, "").slice(0, 15) || "0",
        10,
      );
      const key = `${wallet.publicKey}:${incidentIdNum}`;
      const realHash = hashLookup.get(key);

      if (realHash) {
        await ctx.runMutation(api.rewards.confirmReward, {
          transactionId: record._id as any,
          stellarTransactionHash: realHash,
        });
        updated++;
      } else {
        notFound++;
        console.warn(
          `[Backfill] No match for user=${wallet.publicKey} incident=${incidentIdNum}`,
        );
      }
    }

    return {
      message: `Backfill complete: ${updated} updated, ${notFound} unmatched`,
      updated,
      notFound,
      total: fakeRecords.length,
    };
  },
});
