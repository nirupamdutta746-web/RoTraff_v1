import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Reward amount per verified report (named constant, trivially tunable).
 */
const REPORT_VERIFIED_REWARD = 5;

// ── Queries ──────────────────────────────────────────────────────────────

/**
 * Get the current user's reward transaction history.
 * Ordered newest-first. This is the audit trail — never update or delete rows.
 */
export const getTransactions = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const txns = await ctx.db
      .query("rewardTransactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return txns.map((t) => ({
      _id: t._id,
      amount: t.amount,
      reason: t.reason,
      status: t.status,
      stellarTransactionHash: t.stellarTransactionHash,
      incidentId: t.incidentId,
      createdAt: t.createdAt,
      confirmedAt: t.confirmedAt,
    }));
  },
});

/**
 * Get total confirmed ROTR balance for the current user.
 * Sums all confirmed rewardTransactions for the user.
 */
export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const txns = await ctx.db
      .query("rewardTransactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return txns
      .filter((t) => t.status !== "failed")
      .reduce((sum, t) => sum + t.amount, 0);
  },
});

// ── Mutations ────────────────────────────────────────────────────────────

/**
 * Credit a reward for a verified incident report.
 * Called from the incident confirm mutation when the threshold is crossed.
 *
 * Idempotency: checks rewardTransactions for existing (incidentId, reason) pair.
 * If a row already exists for this incident + reason, returns without creating a duplicate.
 *
 * Flow:
 * 1. Idempotency check — skip if already credited for this incident
 * 2. Ensure user has a wallet (provision if needed)
 * 3. Write reward row with status "pending" synchronously (audit trail exists immediately)
 * 4. Schedule the actual Stellar payment via processPendingReward action
 */
export const creditReport = mutation({
  args: {
    incidentId: v.id("incidents"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Idempotency: one payout per incident per reason
    const existing = await ctx.db
      .query("rewardTransactions")
      .withIndex("by_incident", (q) =>
        q.eq("incidentId", args.incidentId).eq("reason", "report_verified"),
      )
      .unique();
    if (existing) return { credited: false, reason: "already_credited" };

    // Ensure user has a Stellar wallet — provision lazily on first reward
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!wallet) {
      // Schedule wallet provisioning as an action (fetch only runs in actions)
      await ctx.scheduler.runAfter(0, api.walletActions.provisionWalletAction, {
        userId: args.userId,
      });
    }

    // Write the pending reward row — audit trail exists immediately
    const txId = await ctx.db.insert("rewardTransactions", {
      userId: args.userId,
      incidentId: args.incidentId,
      amount: REPORT_VERIFIED_REWARD,
      reason: "report_verified",
      stellarTransactionHash: "", // filled in after Stellar payment
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule the actual Stellar payment (non-blocking)
    // References action in separate file to avoid circular type inference
    await ctx.scheduler.runAfter(0, api.rewardActions.processPendingReward, {
      rewardTransactionId: txId,
    });

    return { credited: true, amount: REPORT_VERIFIED_REWARD, txId };
  },
});

// ── Internal helpers (called by actions via ctx.runQuery/ctx.runMutation) ─

/**
 * Get a single reward transaction by ID (internal use only).
 */
export const getTransactionById = query({
  args: { transactionId: v.id("rewardTransactions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.transactionId);
  },
});

/**
 * Update a reward transaction's status and increment retry count.
 * Only used internally by processPendingReward action.
 */
export const updateRewardStatus = mutation({
  args: {
    transactionId: v.id("rewardTransactions"),
    status: v.union(
      v.literal("pending"),
      v.literal("submitted"),
      v.literal("confirmed"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.transactionId);
    const retryCount = existing?.retryCount ?? 0;
    await ctx.db.patch(args.transactionId, {
      status: args.status,
      retryCount: retryCount + 1,
    });
  },
});

/**
 * Confirm a reward — set status to "confirmed" with the tx hash and timestamp.
 */
export const confirmReward = mutation({
  args: {
    transactionId: v.id("rewardTransactions"),
    stellarTransactionHash: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transactionId, {
      status: "confirmed",
      stellarTransactionHash: args.stellarTransactionHash,
      confirmedAt: Date.now(),
    });
  },
});

/**
 * Retry a failed reward by resetting it to pending and re-scheduling processing.
 * Only allows retrying transactions that were recently failed (within 1 hour).
 */
export const retryFailedReward = mutation({
  args: { transactionId: v.id("rewardTransactions") },
  handler: async (ctx, args) => {
    const txn = await ctx.db.get(args.transactionId);
    if (!txn || txn.status !== "failed") return { retried: false };

    // Only allow retrying recent failures (within 1 hour)
    if (Date.now() - txn.createdAt > 60 * 60 * 1000) return { retried: false };

    // Reset to pending and clear retry count
    await ctx.db.patch(args.transactionId, {
      status: "pending",
      retryCount: 0,
    });

    // Re-schedule the payment processing
    await ctx.scheduler.runAfter(0, api.rewardActions.processPendingReward, {
      rewardTransactionId: args.transactionId,
    });

    return { retried: true };
  },
});

/**
 * One-off admin reset: force any failed reward back to pending.
 * No time window restriction — use this to recover transactions
 * that failed due to the wallet provisioning race condition.
 *
 * Paste into Convex dashboard → Functions → rewards.forceRetryFailedReward
 * Args: { transactionId: "<id>" }
 */
export const forceRetryFailedReward = mutation({
  args: { transactionId: v.id("rewardTransactions") },
  handler: async (ctx, args) => {
    const txn = await ctx.db.get(args.transactionId);
    if (!txn) return { success: false, error: "Transaction not found" };
    if (txn.status !== "failed") return { success: false, error: `Status is '${txn.status}', not 'failed'` };

    // Reset to pending and clear retry count
    await ctx.db.patch(args.transactionId, {
      status: "pending",
      retryCount: 0,
    });

    // Re-schedule the payment processing
    await ctx.scheduler.runAfter(0, api.rewardActions.processPendingReward, {
      rewardTransactionId: args.transactionId,
    });

    return { success: true, message: `Reset tx ${args.transactionId} to pending, re-scheduled for payment.` };
  },
});

/**
 * Admin cleanup: delete a single reward transaction by ID.
 * Use this to remove stale records from a previous contract or test data.
 *
 * Convex dashboard → Functions → rewards.deleteTransaction
 * Args: { transactionId: "<id>" }
 */
export const deleteTransaction = mutation({
  args: { transactionId: v.id("rewardTransactions") },
  handler: async (ctx, args) => {
    const txn = await ctx.db.get(args.transactionId);
    if (!txn) return { success: false, error: "Transaction not found" };
    await ctx.db.delete(args.transactionId);
    return { success: true, deleted: args.transactionId };
  },
});

/**
 * Get all confirmed transactions with the old fake hash (for backfill).
 * Returns records that need their stellarTransactionHash corrected.
 */
export const getConfirmedWithFakeHash = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("rewardTransactions")
      .withIndex("by_status", (q) => q.eq("status", "confirmed"))
      .collect()
      .then((txns) =>
        txns
          .filter((t) => t.stellarTransactionHash === "contract_invoked")
          .map((t) => ({
            _id: t._id,
            userId: t.userId,
            incidentId: t.incidentId,
            amount: t.amount,
            reason: t.reason,
            createdAt: t.createdAt,
          })),
      );
  },
});

/**
 * Get all pending reward transactions (for batch processing).
 */
export const getPendingTransactions = query({
  args: {},
  handler: async (ctx) => {
    const pending = await ctx.db
      .query("rewardTransactions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return pending.filter((t) => (t.retryCount ?? 0) < 3);
  },
});
