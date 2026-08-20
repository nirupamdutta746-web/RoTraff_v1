import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

/**
 * Every 5 minutes, process any reward transactions stuck in "pending" state.
 * This catches cases where:
 * - The Stellar network was briefly down when the reward was first attempted
 * - The processPendingReward action failed for a transient reason
 * - Multiple rewards need batch processing
 *
 * Failed transactions are marked as "failed" after 3 retries to prevent infinite loops.
 */
crons.interval(
  "retry-pending-rewards",
  { minutes: 5 },
  api.rewardActions.processAllPending,
);

export default crons;
