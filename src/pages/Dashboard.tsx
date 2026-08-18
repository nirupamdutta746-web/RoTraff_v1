import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  AlertTriangle,
  MapPin,
  Route,
  Shield,
  User,
  LogOut,
  Plus,
  X,
  ChevronDown,
  Clock,
  Zap,
  Search,
  Navigation,
  Layers,
  CheckCircle2,
  XCircle,
  History,
  Filter,
  AlertCircle,
  Construction,
  Droplets,
  Flame,
  Snowflake,
  Trash2,
  Loader2,
  Menu,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// --- Icon helpers for Leaflet markers ---
function createIncidentIcon(type: string, severity: string) {
  const colorMap: Record<string, string> = {
    pothole: "#eab308",
    landslide: "#a16207",
    accident: "#ef4444",
    flood: "#3b82f6",
    construction: "#f97316",
    debris: "#8b5cf6",
    ice: "#06b6d4",
    other: "#6b7280",
  };
  const color = colorMap[type] || "#6b7280";

  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 32px; height: 32px; border-radius: 50%;
      background: ${color}; display: flex; align-items: center;
      justify-content: center; box-shadow: 0 4px 12px ${color}44;
      border: 2.5px solid white;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

// Severity badge colors
const severityColors: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 border-emerald-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const typeIcons: Record<string, React.ReactNode> = {
  pothole: <AlertCircle className="w-3.5 h-3.5" />,
  landslide: <Flame className="w-3.5 h-3.5" />,
  accident: <AlertTriangle className="w-3.5 h-3.5" />,
  flood: <Droplets className="w-3.5 h-3.5" />,
  construction: <Construction className="w-3.5 h-3.5" />,
  debris: <Trash2 className="w-3.5 h-3.5" />,
  ice: <Snowflake className="w-3.5 h-3.5" />,
  other: <AlertCircle className="w-3.5 h-3.5" />,
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

// --- Map click handler ---
function MapClickHandler({
  onClick,
}: {
  onClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// --- Fly to location helper ---
function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15, { duration: 1.2 });
  }, [center, map]);
  return null;
}

// --- Risk calculation helper ---
function calculateRiskScore(incidentCount: number): number {
  // Simple risk model: 0-100 scale
  const base = Math.min(incidentCount * 15, 80);
  return Math.min(base + Math.random() * 20, 100);
}

// --- Route simulation ---
function generateRoute(
  origin: [number, number],
  dest: [number, number],
  variant: "fastest" | "safest" | "balanced",
): {
  path: [number, number][];
  riskScore: number;
  travelTime: string;
  distance: string;
} {
  const midLat = (origin[0] + dest[0]) / 2;
  const midLng = (origin[1] + dest[1]) / 2;

  // Generate slight offsets for different routes
  const offsets: Record<string, { lat: number; lng: number; risk: number; time: string; dist: string }> = {
    fastest: { lat: 0.01, lng: -0.005, risk: 45, time: "18 min", dist: "4.2 km" },
    safest: { lat: -0.008, lng: 0.012, risk: 8, time: "24 min", dist: "5.8 km" },
    balanced: { lat: 0.003, lng: 0.002, risk: 22, time: "21 min", dist: "4.9 km" },
  };

  const off = offsets[variant];
  const mid1: [number, number] = [
    midLat + off.lat * 0.6,
    midLng + off.lng * 0.4,
  ];
  const mid2: [number, number] = [
    midLat - off.lat * 0.3,
    midLng + off.lng * 0.8,
  ];

  return {
    path: [origin, mid1, mid2, dest],
    riskScore: off.risk + Math.floor(Math.random() * 5),
    travelTime: off.time,
    distance: off.dist,
  };
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const incidents = useQuery(api.incidents.list);
  const reportIncident = useMutation(api.incidents.report);
  const confirmIncident = useMutation(api.incidents.confirm);
  const createSession = useMutation(api.sessions.create);

  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([40.7128, -74.006]);
  const [zoom, setZoom] = useState(12);

  // Incident report state
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reportSeverity, setReportSeverity] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportLocation, setReportLocation] = useState<[number, number] | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  // Route planning state
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<"fastest" | "safest" | "balanced">("balanced");
  const [routes, setRoutes] = useState<ReturnType<typeof generateRoute>[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Sidebar
  const [sidebarTab, setSidebarTab] = useState<"incidents" | "routes">("incidents");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Get user's location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setMapCenter([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          // Default to NYC if geolocation fails
        },
      );
    }
  }, []);

  // Handle map click for incident reporting
  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (showReportPanel) {
        setReportLocation([lat, lng]);
      }
    },
    [showReportPanel],
  );

  // Filter incidents
  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];
    if (typeFilter === "all") return incidents;
    return incidents.filter((i) => i.type === typeFilter);
  }, [incidents, typeFilter]);

  // Submit incident report
  const handleReportSubmit = async () => {
    if (!reportType || !reportSeverity || !reportLocation) {
      toast.error("Please fill in all required fields and select a location on the map.");
      return;
    }

    setIsReporting(true);
    try {
      await reportIncident({
        type: reportType,
        severity: reportSeverity,
        lat: reportLocation[0],
        lng: reportLocation[1],
        description: reportDesc || undefined,
      });

      // Log session
      await createSession({
        type: "report",
        title: `Reported ${typeLabels[reportType] || reportType}`,
        originLat: reportLocation[0],
        originLng: reportLocation[1],
        originName: `${reportLocation[0].toFixed(4)}, ${reportLocation[1].toFixed(4)}`,
      });

      toast.success("Incident reported successfully!");
      setShowReportPanel(false);
      setReportType("");
      setReportSeverity("");
      setReportDesc("");
      setReportLocation(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to report incident.");
    } finally {
      setIsReporting(false);
    }
  };

  // Calculate routes
  const handleCalculateRoutes = async () => {
    if (!originCoords || !destCoords) {
      toast.error("Please set both origin and destination locations.");
      return;
    }

    setIsCalculating(true);

    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));

    const fastest = generateRoute(originCoords, destCoords, "fastest");
    const safest = generateRoute(originCoords, destCoords, "safest");
    const balanced = generateRoute(originCoords, destCoords, "balanced");

    setRoutes([
      { ...fastest },
      { ...balanced },
      { ...safest },
    ]);

    // Log session
    try {
      await createSession({
        type: "route",
        title: `Route: ${origin} → ${destination}`,
        originLat: originCoords[0],
        originLng: originCoords[1],
        originName: origin,
        destLat: destCoords[0],
        destLng: destCoords[1],
        destName: destination,
        riskScore: balanced.riskScore,
        travelTime: balanced.travelTime,
        incidentsNearby: filteredIncidents.length,
      });
    } catch {
      // Session logging is best-effort
    }

    setIsCalculating(false);
    setSelectedRoute("balanced");
  };

  // Handle confirm incident
  const handleConfirmIncident = async (id: string) => {
    try {
      await confirmIncident({ id: id as any });
      toast.success("Incident confirmed!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm.");
    }
  };

  // Set origin/dest from map click
  const setOriginFromMap = () => {
    if (reportLocation) {
      setOriginCoords(reportLocation);
      setOrigin(`${reportLocation[0].toFixed(4)}, ${reportLocation[1].toFixed(4)}`);
      setShowReportPanel(false);
      setShowRoutePanel(true);
      setSidebarTab("routes");
    }
  };

  const setDestFromMap = () => {
    if (reportLocation) {
      setDestCoords(reportLocation);
      setDestination(`${reportLocation[0].toFixed(4)}, ${reportLocation[1].toFixed(4)}`);
      setShowReportPanel(false);
      setShowRoutePanel(true);
      setSidebarTab("routes");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const selectedRouteData = routes[selectedRoute === "fastest" ? 0 : selectedRoute === "balanced" ? 1 : 2];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Navigation Bar */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong border-b border-white/30 px-4 py-2.5 z-40 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden cursor-pointer"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-md shadow-blue-500/20">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground hidden sm:block">SafeRoad</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={sidebarTab === "incidents" && isSidebarOpen ? "default" : "ghost"}
            size="sm"
            onClick={() => { setSidebarTab("incidents"); setIsSidebarOpen(true); }}
            className="cursor-pointer gap-1.5 hidden sm:flex"
          >
            <AlertTriangle className="w-4 h-4" />
            <span className="hidden lg:inline">Incidents</span>
          </Button>
          <Button
            variant={sidebarTab === "routes" && isSidebarOpen ? "default" : "ghost"}
            size="sm"
            onClick={() => { setSidebarTab("routes"); setIsSidebarOpen(true); }}
            className="cursor-pointer gap-1.5 hidden sm:flex"
          >
            <Route className="w-4 h-4" />
            <span className="hidden lg:inline">Routes</span>
          </Button>
          <div className="w-px h-6 bg-border mx-1 hidden sm:block" />
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            onClick={() => navigate("/sessions")}
          >
            <History className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer"
            onClick={() => navigate("/profile")}
          >
            <User className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="cursor-pointer text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="glass-strong border-r border-white/30 z-30 flex-shrink-0 overflow-hidden hidden md:flex flex-col"
            >
              {/* Mobile tab switcher */}
              <div className="flex sm:hidden border-b border-white/20">
                <button
                  onClick={() => setSidebarTab("incidents")}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${sidebarTab === "incidents" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
                >
                  Incidents
                </button>
                <button
                  onClick={() => setSidebarTab("routes")}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${sidebarTab === "routes" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
                >
                  Routes
                </button>
              </div>

              {sidebarTab === "incidents" ? (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Filter bar */}
                  <div className="p-3 border-b border-white/20">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="w-full glass rounded-lg pl-8 pr-3 py-2 text-sm bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
                        >
                          <option value="all">All types</option>
                          {Object.entries(typeLabels).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {filteredIncidents.length} active
                      </span>
                    </div>
                  </div>

                  {/* Incident list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {filteredIncidents.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">No incidents reported</p>
                        <p className="text-xs mt-1">Click the map to report one</p>
                      </div>
                    ) : (
                      filteredIncidents.map((incident) => (
                        <motion.div
                          key={incident._id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="glass rounded-xl p-3 hover:bg-white/50 transition-colors cursor-pointer"
                          onClick={() => {
                            setMapCenter([incident.lat, incident.lng]);
                            setZoom(16);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
                                {typeIcons[incident.type] || <AlertCircle className="w-3.5 h-3.5" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold truncate">
                                    {typeLabels[incident.type] || incident.type}
                                  </p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${severityColors[incident.severity] || ""}`}>
                                    {incident.severity}
                                  </span>
                                </div>
                                {incident.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                    {incident.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[10px] text-muted-foreground">
                                    by {incident.reportedBy}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {incident.reports} confirm{incident.reports !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 flex-shrink-0 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmIncident(incident._id);
                              }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </Button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Route planner */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Route className="w-4 h-4 text-primary" />
                      Plan a Route
                    </h3>

                    <div className="space-y-2">
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
                        <Input
                          placeholder="Origin (click map to set)"
                          value={origin}
                          onChange={(e) => setOrigin(e.target.value)}
                          className="glass pl-8 border-white/30 bg-white/40"
                        />
                      </div>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-500" />
                        <Input
                          placeholder="Destination (click map to set)"
                          value={destination}
                          onChange={(e) => setDestination(e.target.value)}
                          className="glass pl-8 border-white/30 bg-white/40"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleCalculateRoutes}
                      disabled={!originCoords || !destCoords || isCalculating}
                      className="w-full cursor-pointer bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600"
                    >
                      {isCalculating ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Navigation className="w-4 h-4 mr-2" />
                      )}
                      {isCalculating ? "Calculating..." : "Find Routes"}
                    </Button>
                  </div>

                  {/* Route results */}
                  {routes.length > 0 && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Route options
                      </p>

                      {[
                        { key: "fastest" as const, label: "Fastest", icon: Zap, color: "text-amber-500" },
                        { key: "balanced" as const, label: "Balanced", icon: Route, color: "text-blue-500" },
                        { key: "safest" as const, label: "Safest", icon: Shield, color: "text-emerald-500" },
                      ].map((opt, i) => {
                        const r = routes[i];
                        const isSelected = selectedRoute === opt.key;
                        return (
                          <motion.div
                            key={opt.key}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => setSelectedRoute(opt.key)}
                            className={`glass rounded-xl p-3 cursor-pointer transition-all ${
                              isSelected
                                ? "ring-2 ring-primary/50 bg-white/60"
                                : "hover:bg-white/40"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <opt.icon className={`w-4 h-4 ${opt.color}`} />
                                <span className="text-sm font-bold">{opt.label}</span>
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center">
                              <div className="glass-subtle rounded-lg p-1.5">
                                <Clock className="w-3 h-3 text-muted-foreground mx-auto mb-0.5" />
                                <p className="text-xs font-bold">{r.travelTime}</p>
                              </div>
                              <div className="glass-subtle rounded-lg p-1.5">
                                <MapPin className="w-3 h-3 text-muted-foreground mx-auto mb-0.5" />
                                <p className="text-xs font-bold">{r.distance}</p>
                              </div>
                              <div className="glass-subtle rounded-lg p-1.5">
                                <Shield className="w-3 h-3 text-muted-foreground mx-auto mb-0.5" />
                                <p className={`text-xs font-bold ${r.riskScore < 15 ? "text-emerald-600" : r.riskScore < 35 ? "text-amber-600" : "text-red-600"}`}>
                                  {r.riskScore}%
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={mapCenter}
            zoom={zoom}
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onClick={handleMapClick} />
            <FlyTo center={mapCenter} />

            {/* Incident markers */}
            {filteredIncidents.map((incident) => (
              <Marker
                key={incident._id}
                position={[incident.lat, incident.lng]}
                icon={createIncidentIcon(incident.type, incident.severity)}
              />
            ))}

            {/* Report location marker */}
            {reportLocation && (
              <Marker
                position={reportLocation}
                icon={L.divIcon({
                  className: "report-marker",
                  html: `<div style="
                    width: 20px; height: 20px; border-radius: 50%;
                    background: #3b82f6; border: 3px solid white;
                    box-shadow: 0 0 0 4px rgba(59,130,246,0.2), 0 4px 12px rgba(59,130,246,0.3);
                  "></div>`,
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })}
              />
            )}

            {/* Route polyline */}
            {routes.length > 0 && selectedRouteData && (
              <Polyline
                positions={selectedRouteData.path}
                pathOptions={{
                  color: selectedRoute === "safest" ? "#10b981" : selectedRoute === "fastest" ? "#f59e0b" : "#3b82f6",
                  weight: 5,
                  opacity: 0.8,
                  dashArray: selectedRoute === "safest" ? "8 6" : undefined,
                }}
              />
            )}
          </MapContainer>

          {/* Map overlay controls */}
          <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-strong rounded-xl overflow-hidden shadow-lg"
            >
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-none cursor-pointer"
                onClick={() => setZoom((z) => Math.min(z + 1, 18))}
              >
                <Plus className="w-4 h-4" />
              </Button>
              <div className="w-full h-px bg-white/30" />
              <Button
                variant="ghost"
                size="icon"
                className="w-10 h-10 rounded-none cursor-pointer"
                onClick={() => setZoom((z) => Math.max(z - 1, 3))}
              >
                <X className="w-4 h-4" />
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="glass-strong w-10 h-10 cursor-pointer shadow-lg"
                onClick={() => {
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition((pos) => {
                      setMapCenter([pos.coords.latitude, pos.coords.longitude]);
                      setZoom(14);
                    });
                  }
                }}
              >
                <Navigation className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>

          {/* Report incident FAB */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="absolute bottom-6 right-6 z-20"
          >
            <Button
              onClick={() => {
                setShowReportPanel(!showReportPanel);
                setShowRoutePanel(false);
              }}
              className={`cursor-pointer rounded-2xl px-5 py-6 shadow-xl font-semibold gap-2 ${
                showReportPanel
                  ? "bg-white text-foreground border border-border hover:bg-white/90"
                  : "bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600 shadow-blue-500/25"
              }`}
            >
              {showReportPanel ? (
                <>
                  <X className="w-5 h-5" />
                  Close
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  Report Incident
                </>
              )}
            </Button>
          </motion.div>
        </div>

        {/* Report Incident Panel */}
        <AnimatePresence>
          {showReportPanel && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full sm:w-96 glass-strong border-l border-white/30 z-30 flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/20 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Report Incident</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Click the map to select a location
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="cursor-pointer"
                  onClick={() => {
                    setShowReportPanel(false);
                    setReportLocation(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Location indicator */}
                <div className="glass rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">Selected Location</p>
                    {reportLocation ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {reportLocation[0].toFixed(5)}, {reportLocation[1].toFixed(5)}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600">
                        Click on the map to select
                      </p>
                    )}
                  </div>
                </div>

                {/* Set as origin/dest buttons */}
                {reportLocation && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 glass border-white/30 bg-white/40 cursor-pointer"
                      onClick={setOriginFromMap}
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
                      Set as Origin
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 glass border-white/30 bg-white/40 cursor-pointer"
                      onClick={setDestFromMap}
                    >
                      <div className="w-2 h-2 rounded-full bg-violet-500 mr-1.5" />
                      Set as Dest
                    </Button>
                  </div>
                )}

                {/* Incident type */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5">
                    Incident Type *
                  </label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="glass border-white/30 bg-white/40 cursor-pointer">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            {typeIcons[key]}
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Severity */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5">
                    Severity *
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["low", "medium", "high", "critical"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setReportSeverity(s)}
                        className={`glass rounded-lg py-2 px-1 text-xs font-semibold capitalize transition-all cursor-pointer ${
                          reportSeverity === s
                            ? `${severityColors[s]} ring-2 ring-offset-1 ring-current/20`
                            : "bg-white/40 hover:bg-white/60"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5">
                    Description
                  </label>
                  <Textarea
                    placeholder="Additional details (optional)..."
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    className="glass border-white/30 bg-white/40 resize-none h-20"
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="p-4 border-t border-white/20">
                <Button
                  onClick={handleReportSubmit}
                  disabled={!reportType || !reportSeverity || !reportLocation || isReporting}
                  className="w-full cursor-pointer bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600 py-5"
                >
                  {isReporting ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 mr-2" />
                  )}
                  {isReporting ? "Reporting..." : "Submit Report"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
