import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Gift } from "lucide-react";

/**
 * Watches the user's reward transactions and shows a toast
 * whenever a new "confirmed" reward appears (via Convex realtime).
 *
 * Renders a custom styled toast with "+5 ROTR — your report was verified".
 */
export function useRewardToast() {
  const transactions = useQuery(api.rewards.getTransactions);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!transactions) return;

    for (const txn of transactions) {
      if (
        txn.status === "confirmed" &&
        txn.reason === "report_verified" &&
        !seenIds.current.has(txn._id)
      ) {
        seenIds.current.add(txn._id);

        // Only toast for rewards that arrived in the last 30 seconds
        // (skip older ones on page load)
        if (Date.now() - txn.createdAt < 30_000) {
          toast.custom(
            () => (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="glass-card p-4 flex items-center gap-3 shadow-xl border border-emerald-200/50 max-w-sm"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    +{txn.amount} ROTR
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Your report was verified!
                  </p>
                </div>
              </motion.div>
            ),
            { duration: 5000 },
          );
        }
      }
    }
  }, [transactions]);
}
