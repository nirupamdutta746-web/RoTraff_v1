import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Shield,
  ArrowLeft,
  LogOut,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Construction,
  Droplets,
  Flame,
  Snowflake,
  Trash2,
  Eye,
  Image,
  Users,
  BarChart3,
  MapPin,
  Filter,
  Search,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const severityColors: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const typeIcons: Record<string, React.ReactNode> = {
  pothole: <AlertCircle className="w-4 h-4" />,
  landslide: <Flame className="w-4 h-4" />,
  accident: <AlertTriangle className="w-4 h-4" />,
  flood: <Droplets className="w-4 h-4" />,
  construction: <Construction className="w-4 h-4" />,
  debris: <Trash2 className="w-4 h-4" />,
  ice: <Snowflake className="w-4 h-4" />,
  other: <AlertCircle className="w-4 h-4" />,
};

const typeLabels: Record<string, string> = {
  pothole: "Pothole",
  landslide: "Landslide",
  accident: "Accident",
  flood: "Flood",
  construction: "Construction",
  debris: "Road Debris",
  ice: "Ice / Frost",
  other: "Other Hazard",
};

const statusColors: Record<string, string> = {
  active: "bg-amber-100 text-amber-700",
  verified: "bg-emerald-100 text-emerald-700",
  resolved: "bg-blue-100 text-blue-700",
  permanent: "bg-violet-100 text-violet-700",
};

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

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const allIncidents = useQuery(api.incidents.adminListAll);
  const allUsers = useQuery(api.users.listAll);
  const verifyIncident = useMutation(api.incidents.adminVerify);
  const removeIncident = useMutation(api.incidents.adminRemove);
  const deleteIncident = useMutation(api.incidents.remove);
  const setUserRole = useMutation(api.users.setRole);
  const deleteUser = useMutation(api.users.adminDeleteUser);

  const [activeTab, setActiveTab] = useState<"incidents" | "users">("incidents");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [imageModalUrl, setImageModalUrl] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Stats
  const totalIncidents = allIncidents?.length ?? 0;
  const activeIncidents = allIncidents?.filter((i) => i.status === "active").length ?? 0;
  const verifiedIncidents = allIncidents?.filter((i) => i.status === "verified").length ?? 0;
  const resolvedIncidents = allIncidents?.filter((i) => i.status === "resolved").length ?? 0;
  const totalUsers = allUsers?.length ?? 0;

  // Filtered incidents
  const filtered = (allIncidents ?? []).filter((inc) => {
    if (statusFilter !== "all" && inc.status !== statusFilter) return false;
    if (typeFilter !== "all" && inc.type !== typeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inc.reportedBy.toLowerCase().includes(q) ||
        inc.description?.toLowerCase().includes(q) ||
        typeLabels[inc.type]?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleVerify = async (id: string) => {
    setActionLoading(id);
    try {
      await verifyIncident({ id: id as any });
      toast.success("Incident verified!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to verify.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (id: string) => {
    setActionLoading(id);
    try {
      await removeIncident({ id: id as any });
      toast.success("Incident removed from map.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await deleteIncident({ id: id as any });
      toast.success("Incident permanently deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      return;
    }
    setActionLoading(userId);
    try {
      await deleteUser({ userId: userId as any });
      toast.success("User deleted successfully.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete user.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: "admin" | "user" | "member") => {
    setActionLoading(userId);
    try {
      await setUserRole({ userId: userId as any, role: newRole });
      toast.success(`Role updated to ${newRole}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong border-b border-white/30 px-4 py-3 sticky top-0 z-40"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-linear-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-md">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground">Manage incidents & users</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="cursor-pointer text-muted-foreground hover:text-destructive" onClick={handleSignOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Total Incidents", value: totalIncidents, icon: <AlertTriangle className="w-5 h-5" />, color: "text-blue-500" },
            { label: "Pending Review", value: activeIncidents, icon: <Clock className="w-5 h-5" />, color: "text-amber-500" },
            { label: "Verified", value: verifiedIncidents, icon: <CheckCircle2 className="w-5 h-5" />, color: "text-emerald-500" },
            { label: "Resolved", value: resolvedIncidents, icon: <XCircle className="w-5 h-5" />, color: "text-blue-500" },
            { label: "Total Users", value: totalUsers, icon: <Users className="w-5 h-5" />, color: "text-violet-500" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 text-center"
            >
              <div className={`mx-auto mb-2 ${stat.color}`}>{stat.icon}</div>
              <p className="text-2xl font-extrabold gradient-text">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          {([
            { key: "incidents" as const, label: "Incidents", icon: <AlertTriangle className="w-4 h-4" /> },
            { key: "users" as const, label: "Users", icon: <Users className="w-4 h-4" /> },
          ]).map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "default" : "ghost"}
              size="sm"
              className="cursor-pointer gap-1.5"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </Button>
          ))}
        </div>

        {/* Filters (Incidents tab only) */}
        {activeTab === "incidents" && (
        <div className="glass-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by reporter, description, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 glass border-white/30 bg-white/40"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="glass rounded-lg px-3 py-2 text-sm bg-white/40 border border-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="verified">Verified</option>
              <option value="resolved">Resolved</option>
              <option value="permanent">Permanent</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="glass rounded-lg px-3 py-2 text-sm bg-white/40 border border-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
            >
              <option value="all">All Types</option>
              {Object.entries(typeLabels).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        )}

        {/* ══════ INCIDENTS TAB ══════ */}
        {activeTab === "incidents" && (
        <div className="space-y-3">
          {!allIncidents ? (
            <div className="glass-card p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Loading incidents...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-40 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">No incidents match your filters</p>
            </div>
          ) : (
            filtered.map((inc, i) => (
              <motion.div
                key={inc._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.5) }}
                className="glass-card overflow-hidden"
              >
                {/* Incident Header */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-white/20 transition-colors"
                  onClick={() => setExpandedId(expandedId === inc._id ? null : inc._id)}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                    {typeIcons[inc.type] || <AlertCircle className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold">{typeLabels[inc.type] || inc.type}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${severityColors[inc.severity] || ""}`}>
                        {inc.severity}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[inc.status] || ""}`}>
                        {inc.status}
                      </span>
                      {inc.imageUrl && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-0.5">
                          <Image className="w-3 h-3" /> Photo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      <span>by {inc.reportedBy}</span>
                      <span>{inc.reports} confirm{inc.reports !== 1 ? "s" : ""}</span>
                      <span>{formatTimeAgo(inc.createdAt)}</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {inc.lat.toFixed(4)}, {inc.lng.toFixed(4)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {expandedId === inc._id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedId === inc._id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-white/20 pt-3 space-y-3">
                        {/* Description */}
                        {inc.description && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Description</p>
                            <p className="text-sm">{inc.description}</p>
                          </div>
                        )}

                        {/* Photo */}
                        {inc.imageUrl && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Proof Photo</p>
                            <div className="relative inline-block">
                              <img
                                src={inc.imageUrl}
                                alt="Incident proof"
                                className="w-full max-w-sm h-48 object-cover rounded-xl border border-white/30 cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => setImageModalUrl(inc.imageUrl!)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 w-7 h-7 glass cursor-pointer"
                                onClick={() => setImageModalUrl(inc.imageUrl!)}
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Location */}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Location</p>
                          <p className="text-sm">{inc.lat.toFixed(6)}, {inc.lng.toFixed(6)}</p>
                        </div>

                        {/* Timestamps */}
                        <div className="flex gap-4">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Reported</p>
                            <p className="text-xs">{new Date(inc.createdAt).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Last Updated</p>
                            <p className="text-xs">{new Date(inc.updatedAt).toLocaleString()}</p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 pt-2 border-t border-white/20">
                          {inc.status === "active" && (
                            <Button
                              size="sm"
                              className="cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white border-0"
                              onClick={() => handleVerify(inc._id)}
                              disabled={actionLoading === inc._id}
                            >
                              {actionLoading === inc._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              )}
                              Verify Incident
                            </Button>
                          )}
                          {inc.status !== "resolved" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="cursor-pointer border-amber-300 text-amber-700 hover:bg-amber-50"
                              onClick={() => handleRemove(inc._id)}
                              disabled={actionLoading === inc._id}
                            >
                              {actionLoading === inc._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                              )}
                              Remove from Map
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="cursor-pointer border-red-300 text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(inc._id)}
                            disabled={actionLoading === inc._id}
                          >
                            {actionLoading === inc._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          )}
        </div>
        )}

        {/* ══════ USERS TAB ══════ */}
        {activeTab === "users" && (
        <div className="space-y-3">
          {!allUsers ? (
            <div className="glass-card p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Loading users...</p>
            </div>
          ) : allUsers.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Users className="w-8 h-8 mx-auto mb-3 opacity-40 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">No users found</p>
            </div>
          ) : (
            allUsers.map((u) => (
              <motion.div
                key={u._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {u.name?.charAt(0)?.toUpperCase() || u.email?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{u.name || "Unnamed User"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email || "No email"}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      u.role === "admin" ? "bg-red-100 text-red-700" :
                      u.role === "member" ? "bg-violet-100 text-violet-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {u.role || "user"}
                    </span>
                    {u._id === user?._id && (
                      <span className="text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  <select
                    value={u.role || "user"}
                    onChange={(e) => handleRoleChange(u._id, e.target.value as any)}
                    disabled={actionLoading === u._id || u._id === user?._id}
                    className="glass rounded-lg px-3 py-2 text-sm bg-white/40 border border-white/30 focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="user">User</option>
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  {u._id !== user?._id && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => handleDeleteUser(u._id, u.name || u.email || "this user")}
                      disabled={actionLoading === u._id}
                    >
                      {actionLoading === u._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
        )}

        <div className="h-8" />
      </div>

      {/* Image Modal */}
      <AnimatePresence>
        {imageModalUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setImageModalUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-3xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={imageModalUrl} alt="Incident proof full size" className="w-full rounded-2xl shadow-2xl" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-3 right-3 w-10 h-10 glass cursor-pointer"
                onClick={() => setImageModalUrl(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
