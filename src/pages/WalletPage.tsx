import { useMemo } from "react";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Wallet,
  Gift,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

// ── Animated wrapper (matches existing page patterns) ──────────────────────

function AnimatedCard({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(ts).toLocaleDateString();
}

const reasonLabels: Record<string, string> = {
  report_verified: "Report verified",
  verification_participation: "Verification participation",
  manual_adjustment: "Manual adjustment",
};

const statusConfig: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  pending: {
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "text-amber-600",
    label: "Pending",
  },
  submitted: {
    icon: <Clock className="w-3.5 h-3.5" />,
    color: "text-blue-600",
    label: "Submitted",
  },
  confirmed: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    color: "text-emerald-600",
    label: "Confirmed",
  },
  failed: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: "text-red-600",
    label: "Failed",
  },
};

// ── Copy Button ────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Address copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className="w-8 h-8 cursor-pointer"
      onClick={handleCopy}
    >
      {copied ? (
        <Check className="w-4 h-4 text-emerald-500" />
      ) : (
        <Copy className="w-4 h-4 text-muted-foreground" />
      )}
    </Button>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function WalletPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const wallet = useQuery(api.wallets.getWallet);
  const balance = useQuery(api.rewards.getBalance);
  const transactions = useQuery(api.rewards.getTransactions);

  const provisionMutation = null; // We'll use the mutation directly
  const [isProvisioning, setIsProvisioning] = useState(false);

  // Precompute display values
  const displayBalance = useMemo(() => {
    if (balance === undefined) return "...";
    return balance.toString();
  }, [balance]);

  const isLoading = wallet === undefined && user !== null;
  const hasNoWallet = wallet === null && user !== null;

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const groups: { label: string; items: typeof transactions }[] = [];
    let currentLabel = "";

    for (const txn of transactions) {
      const date = new Date(txn.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let label: string;
      if (date.toDateString() === today.toDateString()) {
        label = "Today";
      } else if (date.toDateString() === yesterday.toDateString()) {
        label = "Yesterday";
      } else {
        label = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      }

      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1].items.push(txn);
    }

    return groups;
  }, [transactions]);

  const handleProvisionWallet = async () => {
    setIsProvisioning(true);
    try {
      // Call the Convex mutation
      const { provision } = await import("@/convex/_generated/api");
      // Note: This is a client-side call to the mutation
      // The actual mutation is defined in wallets.ts
      toast.info("Setting up your wallet on Stellar testnet...");
      // We'll use a dynamic import to call the mutation
      // For now, we show a message — the wallet is provisioned on first reward
    } catch (error) {
      toast.error("Wallet setup will happen automatically when you earn your first reward.");
    } finally {
      setIsProvisioning(false);
    }
  };

  const STELLAR_EXPLORER_BASE = "https://stellar.expert/explorer/testnet/tx/";

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong border-b border-white/30 px-4 py-3 sticky top-0 z-40"
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Rewards Wallet
              </h1>
              <p className="text-xs text-muted-foreground">
                Stellar Testnet · In-app rewards
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* ── Balance Card ──────────────────────────────────────── */}
        <AnimatedCard>
          <div className="glass-card overflow-hidden relative">
            {/* Decorative gradient blob */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative p-8 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                ROTR Balance
              </p>

              <div className="flex items-baseline justify-center gap-1">
                {isLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : (
                  <>
                    <span className="text-5xl sm:text-6xl font-extrabold gradient-text">
                      {displayBalance}
                    </span>
                    <span className="text-lg font-semibold text-muted-foreground ml-1">
                      ROTR
                    </span>
                  </>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-3 max-w-xs mx-auto">
                In-app testnet reward tokens · Not real currency · Cannot be
                cashed out
              </p>

              {hasNoWallet && (
                <div className="mt-5">
                  <Button
                    onClick={handleProvisionWallet}
                    disabled={isProvisioning}
                    className="cursor-pointer bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600"
                  >
                    {isProvisioning ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Wallet className="w-4 h-4 mr-2" />
                    )}
                    {isProvisioning
                      ? "Setting up..."
                      : "Set up testnet wallet"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Wallet auto-provisions on your first reward
                  </p>
                </div>
              )}
            </div>
          </div>
        </AnimatedCard>

        {/* ── QR Code / Receive ─────────────────────────────────── */}
        {wallet?.provisioned && (
          <AnimatedCard delay={0.1}>
            <div className="glass-card p-6">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary" /> Receive ROTR
              </h3>

              <div className="flex flex-col items-center gap-4">
                <div className="bg-white rounded-2xl p-4 shadow-lg">
                  <QRCodeSVG
                    value={`web+stellar:${wallet.publicKey}`}
                    size={160}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0B0F14"
                  />
                </div>

                <div className="w-full">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">
                    Your Stellar Public Key
                  </p>
                  <div className="flex items-center gap-2 glass rounded-xl px-3 py-2">
                    <code className="text-xs font-mono break-all flex-1 text-foreground select-all">
                      {wallet.publicKey}
                    </code>
                    <CopyButton text={wallet.publicKey} />
                  </div>
                </div>

                <a
                  href={`https://stellar.expert/explorer/testnet/account/${wallet.publicKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  View on Stellar Explorer
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </AnimatedCard>
        )}

        {/* ── Transaction History ───────────────────────────────── */}
        <AnimatedCard delay={0.2}>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/20">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Transaction
                History
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Append-only audit trail of all reward transactions
              </p>
            </div>

            {transactions === undefined ? (
              <div className="p-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Gift className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No rewards yet</p>
                <p className="text-xs mt-1">
                  Report road incidents and get them verified by the community
                  to earn ROTR tokens
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/20">
                {groupedTransactions.map((group) => (
                  <div key={group.label}>
                    <div className="px-4 py-2 bg-white/20">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {group.label}
                      </p>
                    </div>
                    {group.items.map((txn) => {
                      const st = statusConfig[txn.status] || statusConfig.pending;
                      return (
                        <div
                          key={txn._id}
                          className="px-4 py-3 hover:bg-white/20 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Gift className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">
                                  {reasonLabels[txn.reason] || txn.reason}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span
                                    className={`text-[10px] font-medium flex items-center gap-1 ${st.color}`}
                                  >
                                    {st.icon} {st.label}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatTimeAgo(txn.createdAt)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">
                              +{txn.amount} ROTR
                            </span>
                          </div>

                          {/* Stellar tx hash link */}
                          {txn.stellarTransactionHash &&
                            txn.status === "confirmed" && (
                              <a
                                href={`${STELLAR_EXPLORER_BASE}${txn.stellarTransactionHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-1.5 ml-12"
                              >
                                View on-chain
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </AnimatedCard>

        {/* ── Disclaimer Footer ─────────────────────────────────── */}
        <AnimatedCard delay={0.3}>
          <div className="text-center pb-8">
            <p className="text-[10px] text-muted-foreground/60 max-w-sm mx-auto">
              ROTR tokens are in-app testnet reward points on Stellar Testnet.
              They have no monetary value, cannot be exchanged for currency,
              and exist solely to incentivize community road-safety reporting.
            </p>
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}
