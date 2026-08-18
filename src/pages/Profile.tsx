import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Shield,
  User,
  ArrowLeft,
  Mail,
  AlertTriangle,
  Route,
  History,
  MapPin,
  Clock,
  CheckCircle2,
  LogOut,
  Settings,
  Bell,
  ShieldCheck,
  ChevronRight,
  Zap,
} from "lucide-react";

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

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const sessions = useQuery(api.sessions.listAllRecent, {});
  const incidents = useQuery(
    api.incidents.listByUser,
    user ? { userId: user._id } : "skip" as any,
  );

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Calculate stats
  const totalRoutes = sessions?.filter((s) => s.type === "route").length ?? 0;
  const totalReports = sessions?.filter((s) => s.type === "report").length ?? 0;
  const totalIncidents = incidents?.length ?? 0;
  const verifiedIncidents =
    incidents?.filter((i) => i.status === "verified").length ?? 0;

  const initial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : "U";

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
            <h1 className="text-lg font-bold">My Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="cursor-pointer"
              onClick={() => navigate("/sessions")}
            >
              <History className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Profile Card */}
        <AnimatedCard>
          <div className="glass-card p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-3xl font-extrabold text-white shadow-xl shadow-blue-500/25">
                {initial}
              </div>

              <div className="text-center sm:text-left flex-1">
                <h2 className="text-2xl font-extrabold">
                  {user?.name || "SafeRoad Driver"}
                </h2>
                <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start">
                  {user?.email && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      {user.email}
                    </span>
                  )}
                  {user?.isAnonymous && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                      Guest Account
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Member since {new Date(user?._creationTime ?? Date.now()).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Routes Planned",
              value: totalRoutes,
              icon: <Route className="w-5 h-5" />,
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              label: "Reports Filed",
              value: totalReports,
              icon: <AlertTriangle className="w-5 h-5" />,
              color: "text-amber-500",
              bg: "bg-amber-500/10",
            },
            {
              label: "Incidents Posted",
              value: totalIncidents,
              icon: <MapPin className="w-5 h-5" />,
              color: "text-violet-500",
              bg: "bg-violet-500/10",
            },
            {
              label: "Verified",
              value: verifiedIncidents,
              icon: <CheckCircle2 className="w-5 h-5" />,
              color: "text-emerald-500",
              bg: "bg-emerald-500/10",
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

        {/* Account Settings */}
        <AnimatedCard delay={0.3}>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/20">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                Account Settings
              </h3>
            </div>
            <div className="divide-y divide-white/20">
              {[
                {
                  icon: <User className="w-4 h-4" />,
                  label: "Display Name",
                  value: user?.name || "Not set",
                },
                {
                  icon: <Mail className="w-4 h-4" />,
                  label: "Email",
                  value: user?.email || "Not set",
                },
                {
                  icon: <ShieldCheck className="w-4 h-4" />,
                  label: "Account Type",
                  value: user?.isAnonymous ? "Guest" : "Authenticated",
                },
                {
                  icon: <Bell className="w-4 h-4" />,
                  label: "Notifications",
                  value: "Enabled",
                },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className="px-4 py-3.5 flex items-center justify-between hover:bg-white/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/40 flex items-center justify-center text-muted-foreground">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.value}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                </div>
              ))}
            </div>
          </div>
        </AnimatedCard>

        {/* Quick Actions */}
        <AnimatedCard delay={0.4}>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/20">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Quick Actions
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="cursor-pointer glass border-white/30 bg-white/40 justify-start gap-3 h-auto py-3"
                onClick={() => navigate("/dashboard")}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Route className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Plan a Route</p>
                  <p className="text-xs text-muted-foreground">
                    Find the safest path
                  </p>
                </div>
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer glass border-white/30 bg-white/40 justify-start gap-3 h-auto py-3"
                onClick={() => navigate("/sessions")}
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <History className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">View Sessions</p>
                  <p className="text-xs text-muted-foreground">
                    See your activity
                  </p>
                </div>
              </Button>
            </div>
          </div>
        </AnimatedCard>

        {/* Sign Out */}
        <AnimatedCard delay={0.5}>
          <Button
            variant="outline"
            className="w-full cursor-pointer glass border-white/30 bg-white/40 text-destructive hover:bg-red-50 hover:text-destructive hover:border-red-200"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </AnimatedCard>
      </div>
    </div>
  );
}
