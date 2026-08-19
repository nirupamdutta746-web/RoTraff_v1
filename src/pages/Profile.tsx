import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  Pencil,
  Save,
  X,
  Loader2,
  Globe,
  Eye,
  EyeOff,
  Map,
  TrendingUp,
  Calendar,
  Navigation,
  Trash2,
  AlertCircle,
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

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const sessions = useQuery(api.sessions.listAllRecent, {});
  const incidents = useQuery(
    api.incidents.listByUser,
    user ? { userId: user._id } : ("skip" as any),
  );

  // ── Editable name ──
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(user?.name || "");

  // ── Notification prefs (local state for v1) ──
  const [notifyIncidents, setNotifyIncidents] = useState(true);
  const [notifyRoutes, setNotifyRoutes] = useState(true);
  const [notifyCommunity, setNotifyCommunity] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  // ── Stats ──
  const totalRoutes = sessions?.filter((s) => s.type === "route").length ?? 0;
  const totalReports = sessions?.filter((s) => s.type === "report").length ?? 0;
  const totalIncidents = incidents?.length ?? 0;
  const activeIncidents = incidents?.filter((i) => i.type === "active").length ?? 0;
  const verifiedIncidents = incidents?.filter((i) => i.status === "verified").length ?? 0;
  const avgRisk =
    sessions && sessions.filter((s) => s.type === "route" && s.riskScore != null).length > 0
      ? Math.round(
          sessions
            .filter((s) => s.type === "route" && s.riskScore != null)
            .reduce((sum, s) => sum + (s.riskScore || 0), 0) /
            sessions.filter((s) => s.type === "route" && s.riskScore != null).length,
        )
      : 0;

  const recentSessions = sessions?.slice(0, showAllSessions ? 20 : 5) ?? [];

  const initial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : "U";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSaveName = () => {
    setIsEditingName(false);
    if (editName.trim()) {
      toast.success("Name updated!");
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* ── Header ── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong border-b border-white/30 px-4 py-3 sticky top-0 z-40"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">My Profile</h1>
              <p className="text-xs text-muted-foreground">Manage your account and preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => navigate("/sessions")}>
              <History className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* ══════ PROFILE CARD ══════ */}
        <AnimatedCard>
          <div className="glass-card p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-3xl font-extrabold text-white shadow-xl shadow-blue-500/25 transition-transform group-hover:scale-105">
                  {initial}
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>

              <div className="text-center sm:text-left flex-1">
                {/* Editable name */}
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="glass border-white/30 bg-white/40 text-xl font-extrabold h-auto py-1 max-w-xs"
                      placeholder="Enter your name"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setIsEditingName(false); }}
                    />
                    <Button variant="ghost" size="icon" className="cursor-pointer w-8 h-8" onClick={handleSaveName}>
                      <Save className="w-4 h-4 text-emerald-500" />
                    </Button>
                    <Button variant="ghost" size="icon" className="cursor-pointer w-8 h-8" onClick={() => { setIsEditingName(false); setEditName(user?.name || ""); }}>
                      <X className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-extrabold">{user?.name || "SafeRoad Driver"}</h2>
                    <Button variant="ghost" size="icon" className="cursor-pointer w-7 h-7" onClick={() => { setIsEditingName(true); setEditName(user?.name || ""); }}>
                      <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-1 justify-center sm:justify-start flex-wrap">
                  {user?.email && (
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" /> {user.email}
                    </span>
                  )}
                  {user?.isAnonymous && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Guest Account</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Member since {new Date(user?._creationTime ?? Date.now()).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* ══════ STATS GRID ══════ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Routes Planned", value: totalRoutes, icon: <Route className="w-5 h-5" />, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Reports Filed", value: totalReports, icon: <AlertTriangle className="w-5 h-5" />, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Incidents Posted", value: totalIncidents, icon: <MapPin className="w-5 h-5" />, color: "text-violet-500", bg: "bg-violet-500/10" },
            { label: "Avg Risk Score", value: `${avgRisk}%`, icon: <ShieldCheck className="w-5 h-5" />, color: avgRisk < 20 ? "text-emerald-500" : avgRisk < 40 ? "text-amber-500" : "text-red-500", bg: "bg-emerald-500/10" },
          ].map((stat, i) => (
            <AnimatedCard key={stat.label} delay={i * 0.08}>
              <div className="glass-card p-4 text-center">
                <div className={`mx-auto mb-2 ${stat.color}`}>{stat.icon}</div>
                <p className="text-2xl font-extrabold gradient-text">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            </AnimatedCard>
          ))}
        </div>

        {/* ══════ RECENT ACTIVITY ══════ */}
        <AnimatedCard delay={0.2}>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/20 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> Recent Activity
              </h3>
              <Button variant="ghost" size="sm" className="cursor-pointer text-xs" onClick={() => navigate("/sessions")}>
                View all <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
            <div className="divide-y divide-white/20">
              {recentSessions.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No activity yet. Plan a route or report an incident to get started.
                </div>
              ) : (
                recentSessions.map((s) => (
                  <div key={s._id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/20 transition-colors cursor-pointer" onClick={() => navigate("/sessions")}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${s.type === "route" ? "bg-blue-500/10" : s.type === "report" ? "bg-amber-500/10" : "bg-violet-500/10"}`}>
                      {s.type === "route" ? <Route className="w-4 h-4 text-blue-500" /> : s.type === "report" ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <Zap className="w-4 h-4 text-violet-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{formatTimeAgo(s.createdAt)}</span>
                        {s.riskScore != null && <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" />{s.riskScore}%</span>}
                        {s.travelTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.travelTime}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </AnimatedCard>

        {/* ══════ ACCOUNT SETTINGS ══════ */}
        <AnimatedCard delay={0.3}>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/20">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> Account Settings
              </h3>
            </div>
            <div className="divide-y divide-white/20">
              <div className="px-4 py-3.5 flex items-center justify-between hover:bg-white/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/40 flex items-center justify-center text-muted-foreground"><User className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-medium">Display Name</p>
                    <p className="text-xs text-muted-foreground">{user?.name || "Not set"}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="cursor-pointer w-8 h-8" onClick={() => setIsEditingName(true)}>
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </div>

              <div className="px-4 py-3.5 flex items-center justify-between hover:bg-white/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/40 flex items-center justify-center text-muted-foreground"><Mail className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-xs text-muted-foreground">{user?.email || "Not set"}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground bg-white/30 px-2 py-1 rounded-full">{user?.isAnonymous ? "Guest" : "Verified"}</span>
              </div>

              <div className="px-4 py-3.5 flex items-center justify-between hover:bg-white/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/40 flex items-center justify-center text-muted-foreground"><ShieldCheck className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-medium">Account Type</p>
                    <p className="text-xs text-muted-foreground">{user?.isAnonymous ? "Guest (limited features)" : "Authenticated (full access)"}</p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3.5 flex items-center justify-between hover:bg-white/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/40 flex items-center justify-center text-muted-foreground"><Globe className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-medium">Location Services</p>
                    <p className="text-xs text-muted-foreground">Used for map centering and route origin</p>
                  </div>
                </div>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                </span>
              </div>
            </div>
          </div>
        </AnimatedCard>

        {/* ══════ NOTIFICATION PREFERENCES ══════ */}
        <AnimatedCard delay={0.35}>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/20">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Notification Preferences
              </h3>
            </div>
            <div className="divide-y divide-white/20">
              {[
                { label: "New incidents nearby", desc: "Get alerted when a hazard is reported near your usual routes", value: notifyIncidents, onChange: setNotifyIncidents, icon: <AlertTriangle className="w-4 h-4" /> },
                { label: "Route safety updates", desc: "Notifications when road conditions change on saved routes", value: notifyRoutes, onChange: setNotifyRoutes, icon: <Route className="w-4 h-4" /> },
                { label: "Community confirmations", desc: "When your reports get confirmed by other drivers", value: notifyCommunity, onChange: setNotifyCommunity, icon: <CheckCircle2 className="w-4 h-4" /> },
              ].map((item) => (
                <div key={item.label} className="px-4 py-3.5 flex items-center justify-between hover:bg-white/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/40 flex items-center justify-center text-muted-foreground">{item.icon}</div>
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <Switch checked={item.value} onCheckedChange={item.onChange} className="cursor-pointer" />
                </div>
              ))}
            </div>
          </div>
        </AnimatedCard>

        {/* ══════ YOUR INCIDENTS ══════ */}
        {incidents && incidents.length > 0 && (
          <AnimatedCard delay={0.4}>
            <div className="glass-card overflow-hidden">
              <div className="p-4 border-b border-white/20 flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Map className="w-4 h-4 text-primary" /> Your Reported Incidents
                </h3>
                <span className="text-xs text-muted-foreground bg-white/30 px-2 py-1 rounded-full">{incidents.length} total</span>
              </div>
              <div className="divide-y divide-white/20 max-h-64 overflow-y-auto">
                {incidents.map((inc) => {
                  const statusColors: Record<string, string> = {
                    active: "bg-emerald-100 text-emerald-700",
                    resolved: "bg-blue-100 text-blue-700",
                    verified: "bg-violet-100 text-violet-700",
                  };
                  return (
                    <div key={inc._id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/20 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-white/40 flex items-center justify-center text-muted-foreground">
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{inc.type}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[inc.status] || ""}`}>{inc.status}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{inc.severity}</span>
                          <span>{inc.reports} confirm{inc.reports !== 1 ? "s" : ""}</span>
                          <span>{formatTimeAgo(inc.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AnimatedCard>
        )}

        {/* ══════ QUICK ACTIONS ══════ */}
        <AnimatedCard delay={0.45}>
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-white/20">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Quick Actions
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button variant="outline" className="cursor-pointer glass border-white/30 bg-white/40 justify-start gap-3 h-auto py-3" onClick={() => navigate("/dashboard")}>
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center"><Navigation className="w-4 h-4 text-blue-500" /></div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Plan a Route</p>
                  <p className="text-xs text-muted-foreground">Find the safest path</p>
                </div>
              </Button>
              <Button variant="outline" className="cursor-pointer glass border-white/30 bg-white/40 justify-start gap-3 h-auto py-3" onClick={() => navigate("/sessions")}>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center"><History className="w-4 h-4 text-amber-500" /></div>
                <div className="text-left">
                  <p className="text-sm font-semibold">View Sessions</p>
                  <p className="text-xs text-muted-foreground">See your activity</p>
                </div>
              </Button>
              <Button variant="outline" className="cursor-pointer glass border-white/30 bg-white/40 justify-start gap-3 h-auto py-3" onClick={() => navigate("/dashboard")}>
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-violet-500" /></div>
                <div className="text-left">
                  <p className="text-sm font-semibold">Report Incident</p>
                  <p className="text-xs text-muted-foreground">Report a road hazard</p>
                </div>
              </Button>
            </div>
          </div>
        </AnimatedCard>

        {/* ══════ DANGER ZONE ══════ */}
        <AnimatedCard delay={0.5}>
          <div className="glass-card overflow-hidden border border-red-200/50">
            <div className="p-4 border-b border-red-100/50">
              <h3 className="text-sm font-bold flex items-center gap-2 text-red-600">
                <AlertCircle className="w-4 h-4" /> Danger Zone
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Signing out will end your current session. You can sign back in anytime with your email.
              </p>
              <Button
                variant="outline"
                className="w-full cursor-pointer border-red-200 bg-red-50/50 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-300"
                onClick={handleSignOut}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </AnimatedCard>
      </div>
    </div>
  );
}
