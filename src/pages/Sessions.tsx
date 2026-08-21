import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery, useMutation } from "convex/react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Shield,
  History,
  MapPin,
  Route,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Trash2,
  Loader2,
  Navigation,
  ShieldCheck,
  Zap,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";

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
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

const typeConfig: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string; label: string }
> = {
  route: {
    icon: <Route className="w-4 h-4" />,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Route Planned",
  },
  report: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "Incident Reported",
  },
  activity: {
    icon: <Zap className="w-4 h-4" />,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    label: "Activity",
  },
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function Sessions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const sessions = useQuery(api.sessions.listAllRecent, {});
  const deleteSession = useMutation(api.sessions.remove);

  const handleDelete = async (id: string) => {
    try {
      await deleteSession({ id: id as any });
      toast.success("Session deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete.");
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong border-b border-white/30 px-4 py-3 sticky top-0 z-40"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
              <h1 className="text-lg font-bold">Activity Sessions</h1>
              <p className="text-xs text-muted-foreground">Your driving and reporting history</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              onClick={() => navigate("/profile")}
            >
              <Shield className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: "Total Sessions",
              value: sessions?.length ?? 0,
              icon: <History className="w-4 h-4" />,
              color: "text-blue-500",
            },
            {
              label: "Routes Planned",
              value: sessions?.filter((s) => s.type === "route").length ?? 0,
              icon: <Route className="w-4 h-4" />,
              color: "text-emerald-500",
            },
            {
              label: "Incidents Reported",
              value: sessions?.filter((s) => s.type === "report").length ?? 0,
              icon: <AlertTriangle className="w-4 h-4" />,
              color: "text-amber-500",
            },
            {
              label: "This Week",
              value:
                sessions?.filter(
                  (s) => s.createdAt > Date.now() - 7 * 86400000,
                ).length ?? 0,
              icon: <Calendar className="w-4 h-4" />,
              color: "text-violet-500",
            },
          ].map((stat, i) => (
            <AnimatedCard key={stat.label} delay={i * 0.08}>
              <div className="glass-card p-4 text-center">
                <div className={`mx-auto mb-2 ${stat.color}`}>{stat.icon}</div>
                <p className="text-2xl font-extrabold gradient-text">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            </AnimatedCard>
          ))}
        </div>

        {/* Session list */}
        {!sessions ? (
          <div className="text-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-2xl">
            <History className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-semibold">No sessions yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Plan routes and report incidents to build your activity history.
            </p>
            <Button
              onClick={() => navigate("/dashboard")}
              className="cursor-pointer bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Open Map
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session, i) => {
              const config = typeConfig[session.type] || typeConfig.activity;
              return (
                <AnimatedCard key={session._id} delay={i * 0.05}>
                  <motion.div
                    whileHover={{ y: -2 }}
                    className="glass-card p-4 flex items-start gap-4 group"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}
                    >
                      <div className={config.color}>{config.icon}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">
                          {session.title}
                        </p>
                        <span className="text-[10px] text-muted-foreground bg-white/40 px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {config.label}
                        </span>
                      </div>

                      {/* Route details */}
                      {session.type === "route" && (
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {session.riskScore !== undefined && (
                            <span className="flex items-center gap-1">
                              <ShieldCheck
                                className={`w-3 h-3 ${
                                  session.riskScore < 15
                                    ? "text-emerald-500"
                                    : session.riskScore < 35
                                      ? "text-amber-500"
                                      : "text-red-500"
                                }`}
                              />
                              Risk: {session.riskScore}%
                            </span>
                          )}
                          {session.travelTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {session.travelTime}
                            </span>
                          )}
                          {session.incidentsNearby !== undefined && (
                            <span className="flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {session.incidentsNearby} nearby
                            </span>
                          )}
                        </div>
                      )}

                      {/* Location details */}
                      {(session.originName || session.destName) && (
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">
                            {session.originName || "Origin"} →{" "}
                            {session.destName || "Destination"}
                          </span>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                        <Clock className="w-2.5 h-2.5 inline mr-1" />
                        {formatTimeAgo(session.createdAt)}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(session._id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </motion.div>
                </AnimatedCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
