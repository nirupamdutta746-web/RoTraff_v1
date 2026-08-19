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
  CircleMarker,
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
  Clock,
  Zap,
  Navigation,
  CheckCircle2,
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
  Locate,
  CircleDot,
  Target,
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

// ─── Marker icon factory ───────────────────────────────────────────────
function createIncidentIcon(type: string) {
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
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px ${color}44;border:2.5px solid white">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

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

// ─── Map interaction helpers ───────────────────────────────────────────

// Click handler dispatches to whatever map mode is active
function MapClickHandler({
  mode,
  onReportClick,
  onOriginClick,
  onDestClick,
}: {
  mode: "idle" | "reporting" | "setOrigin" | "setDest";
  onReportClick: (lat: number, lng: number) => void;
  onOriginClick: (lat: number, lng: number) => void;
  onDestClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (mode === "reporting") onReportClick(lat, lng);
      else if (mode === "setOrigin") onOriginClick(lat, lng);
      else if (mode === "setDest") onDestClick(lat, lng);
    },
  });
  return null;
}

// Flies to a target center smoothly
function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.4 });
  }, [center, zoom, map]);
  return null;
}

// ─── Route generation (simulated, aware of nearby incidents) ───────────
function generateRoute(
  origin: [number, number],
  dest: [number, number],
  variant: "fastest" | "safest" | "balanced",
  nearbyCount: number,
): {
  path: [number, number][];
  riskScore: number;
  travelTime: string;
  distance: string;
} {
  const midLat = (origin[0] + dest[0]) / 2;
  const midLng = (origin[1] + dest[1]) / 2;
  const rawDist =
    Math.sqrt(
      Math.pow((dest[0] - origin[0]) * 111, 2) +
        Math.pow((dest[1] - origin[1]) * 111 * Math.cos((origin[0] * Math.PI) / 180), 2),
    );
  const baseKm = Math.max(rawDist, 1);

  const configs = {
    fastest: { latOff: 0.008, lngOff: -0.004, riskBase: 35, timeMult: 1.0, distMult: 1.0 },
    balanced: { latOff: 0.003, lngOff: 0.003, riskBase: 18, timeMult: 1.2, distMult: 1.1 },
    safest: { latOff: -0.006, lngOff: 0.009, riskBase: 5, timeMult: 1.45, distMult: 1.3 },
  };

  const c = configs[variant];
  const riskIncidentPenalty = Math.min(nearbyCount * 4, 30);
  const riskScore = Math.min(
    Math.max(c.riskBase + riskIncidentPenalty + Math.floor(Math.random() * 8), 2),
    98,
  );
  const dist = (baseKm * c.distMult).toFixed(1);
  const minutes = Math.round((baseKm * c.timeMult * 3.2) + Math.random() * 3);

  return {
    path: [
      origin,
      [midLat + c.latOff * 0.7, midLng + c.lngOff * 0.3],
      [midLat - c.latOff * 0.4, midLng + c.lngOff * 0.9],
      dest,
    ],
    riskScore,
    travelTime: `${minutes} min`,
    distance: `${dist} km`,
  };
}

// ─── Main Component ────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const incidents = useQuery(api.incidents.list);
  const reportIncident = useMutation(api.incidents.report);
  const confirmIncident = useMutation(api.incidents.confirm);
  const createSession = useMutation(api.sessions.create);

  // ── Map state ──
  const [mapCenter, setMapCenter] = useState<[number, number]>([20, 0]);
  const [mapZoom, setMapZoom] = useState(3);
  const [hasLocation, setHasLocation] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);

  // ── Map mode: idle | reporting | setOrigin | setDest ──
  const [mapMode, setMapMode] = useState<"idle" | "reporting" | "setOrigin" | "setDest">("idle");

  // ── Incident report state ──
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reportType, setReportType] = useState("");
  const [reportSeverity, setReportSeverity] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportLocation, setReportLocation] = useState<[number, number] | null>(null);
  const [isReporting, setIsReporting] = useState(false);

  // ── Route planning state ──
  const [showRoutePanel, setShowRoutePanel] = useState(false);
  const [originLabel, setOriginLabel] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<"fastest" | "safest" | "balanced">("balanced");
  const [routes, setRoutes] = useState<ReturnType<typeof generateRoute>[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // ── Filters ──
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // ── Sidebar ──
  const [sidebarTab, setSidebarTab] = useState<"incidents" | "routes">("incidents");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ─── Geolocation on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setMapCenter(c);
        setMapZoom(14);
        setHasLocation(true);
        setLocationLoading(false);
      },
      () => {
        // Fallback: San Francisco
        setMapCenter([37.7749, -122.4194]);
        setMapZoom(12);
        setHasLocation(true);
        setLocationLoading(false);
        toast.info("Using default location. Enable GPS for your position.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // ─── Map click dispatcher ────────────────────────────────────────────
  const handleReportMapClick = useCallback((lat: number, lng: number) => {
    setReportLocation([lat, lng]);
  }, []);

  const handleOriginMapClick = useCallback((lat: number, lng: number) => {
    setOriginCoords([lat, lng]);
    setOriginLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setMapMode("idle");
    toast.success("Origin set! Now tap to set destination.");
  }, []);

  const handleDestMapClick = useCallback((lat: number, lng: number) => {
    setDestCoords([lat, lng]);
    setDestLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setMapMode("idle");
    toast.success("Destination set! Click Find Routes.");
  }, []);

  // ─── Filtered incidents ──────────────────────────────────────────────
  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];
    if (typeFilter === "all") return incidents;
    return incidents.filter((i) => i.type === typeFilter);
  }, [incidents, typeFilter]);

  // ─── Submit incident report ──────────────────────────────────────────
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
      await createSession({
        type: "report",
        title: `Reported ${typeLabels[reportType] || reportType}`,
        originLat: reportLocation[0],
        originLng: reportLocation[1],
        originName: `${reportLocation[0].toFixed(4)}, ${reportLocation[1].toFixed(4)}`,
      });
      toast.success("Incident reported successfully!");
      setShowReportPanel(false);
      setMapMode("idle");
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

  // ─── Calculate routes ────────────────────────────────────────────────
  const handleCalculateRoutes = async () => {
    if (!originCoords || !destCoords) {
      toast.error("Set both origin and destination on the map first.");
      return;
    }
    setIsCalculating(true);
    await new Promise((r) => setTimeout(r, 700));

    const fastest = generateRoute(originCoords, destCoords, "fastest", filteredIncidents.length);
    const balanced = generateRoute(originCoords, destCoords, "balanced", filteredIncidents.length);
    const safest = generateRoute(originCoords, destCoords, "safest", filteredIncidents.length);

    setRoutes([fastest, balanced, safest]);
    setSelectedRoute("balanced");

    try {
      await createSession({
        type: "route",
        title: `Route: ${originLabel} → ${destLabel}`,
        originLat: originCoords[0],
        originLng: originCoords[1],
        originName: originLabel,
        destLat: destCoords[0],
        destLng: destCoords[1],
        destName: destLabel,
        riskScore: balanced.riskScore,
        travelTime: balanced.travelTime,
        incidentsNearby: filteredIncidents.length,
      });
    } catch { /* best-effort */ }

    setIsCalculating(false);
  };

  // ─── Confirm incident ────────────────────────────────────────────────
  const handleConfirmIncident = async (id: string) => {
    try {
      await confirmIncident({ id: id as any });
      toast.success("Incident confirmed!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to confirm.");
    }
  };

  // ─── Sign out ────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const selectedRouteData =
    routes[selectedRoute === "fastest" ? 0 : selectedRoute === "balanced" ? 1 : 2];

  // ─── Mode indicator copy ─────────────────────────────────────────────
  const modeLabel =
    mapMode === "reporting"
      ? "Tap map to place incident marker"
      : mapMode === "setOrigin"
        ? "Tap map to set route origin"
        : mapMode === "setDest"
          ? "Tap map to set route destination"
          : null;

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong border-b border-white/30 px-4 py-2.5 z-[60] flex items-center justify-between relative"
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
          <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => navigate("/sessions")}>
            <History className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => navigate("/profile")}>
            <User className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="cursor-pointer text-muted-foreground hover:text-destructive" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </motion.header>

      {/* ── Main content ────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {isSidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 380, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="glass-strong border-r border-white/30 z-[55] flex-shrink-0 overflow-hidden hidden md:flex flex-col"
            >
              {/* ── Incidents tab ─────────────────────────────────── */}
              {sidebarTab === "incidents" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Filter */}
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
                          {Object.entries(typeLabels).map(([k, l]) => (
                            <option key={k} value={k}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{filteredIncidents.length} active</span>
                    </div>
                  </div>

                  {/* List */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {filteredIncidents.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">No incidents reported</p>
                        <p className="text-xs mt-1">Tap &quot;+ Report Incident&quot; then tap the map</p>
                      </div>
                    ) : (
                      filteredIncidents.map((inc) => (
                        <motion.div
                          key={inc._id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="glass rounded-xl p-3 hover:bg-white/50 transition-colors cursor-pointer"
                          onClick={() => { setMapCenter([inc.lat, inc.lng]); setMapZoom(16); }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
                                {typeIcons[inc.type] || <AlertCircle className="w-3.5 h-3.5" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold truncate">{typeLabels[inc.type] || inc.type}</p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium flex-shrink-0 ${severityColors[inc.severity] || ""}`}>{inc.severity}</span>
                                </div>
                                {inc.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{inc.description}</p>}
                                <div className="flex items-center gap-3 mt-1.5">
                                  <span className="text-[10px] text-muted-foreground">by {inc.reportedBy}</span>
                                  <span className="text-[10px] text-muted-foreground">{inc.reports} confirm{inc.reports !== 1 ? "s" : ""}</span>
                                </div>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon" className="w-7 h-7 flex-shrink-0 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleConfirmIncident(inc._id); }}>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </Button>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ── Routes tab ──────────────────────────────────────── */}
              {sidebarTab === "routes" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="p-4 space-y-3">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Route className="w-4 h-4 text-primary" /> Plan a Route
                    </h3>

                    {/* Origin */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500" />
                          <Input
                            readOnly
                            placeholder="Origin — click to set on map"
                            value={originLabel}
                            className="glass pl-8 border-white/30 bg-white/40 cursor-pointer"
                            onClick={() => {
                              setMapMode(mapMode === "setOrigin" ? "idle" : "setOrigin");
                              toast.info("Now tap the map to set origin");
                            }}
                          />
                        </div>
                        <Button
                          variant={mapMode === "setOrigin" ? "default" : "outline"}
                          size="icon"
                          className="cursor-pointer glass border-white/30 bg-white/40 flex-shrink-0"
                          onClick={() => {
                            setMapMode(mapMode === "setOrigin" ? "idle" : "setOrigin");
                            if (mapMode !== "setOrigin") toast.info("Tap the map to set origin");
                          }}
                        >
                          <CircleDot className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Destination */}
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-500" />
                          <Input
                            readOnly
                            placeholder="Destination — click to set on map"
                            value={destLabel}
                            className="glass pl-8 border-white/30 bg-white/40 cursor-pointer"
                            onClick={() => {
                              setMapMode(mapMode === "setDest" ? "idle" : "setDest");
                              toast.info("Now tap the map to set destination");
                            }}
                          />
                        </div>
                        <Button
                          variant={mapMode === "setDest" ? "default" : "outline"}
                          size="icon"
                          className="cursor-pointer glass border-white/30 bg-white/40 flex-shrink-0"
                          onClick={() => {
                            setMapMode(mapMode === "setDest" ? "idle" : "setDest");
                            if (mapMode !== "setDest") toast.info("Tap the map to set destination");
                          }}
                        >
                          <Target className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Quick-set from current location */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full cursor-pointer text-xs"
                      onClick={() => {
                        if (!hasLocation) { toast.error("Location not available"); return; }
                        navigator.geolocation.getCurrentPosition((pos) => {
                          const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                          setOriginCoords(c);
                          setOriginLabel(`${c[0].toFixed(5)}, ${c[1].toFixed(5)}`);
                          toast.success("Origin set to current location");
                        });
                      }}
                    >
                      <Locate className="w-3.5 h-3.5 mr-1.5" />
                      Use current location as origin
                    </Button>

                    {/* Calculate button */}
                    <Button
                      onClick={handleCalculateRoutes}
                      disabled={!originCoords || !destCoords || isCalculating}
                      className="w-full cursor-pointer bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600"
                    >
                      {isCalculating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Navigation className="w-4 h-4 mr-2" />}
                      {isCalculating ? "Calculating..." : "Find Routes"}
                    </Button>
                  </div>

                  {/* Route results */}
                  {routes.length > 0 && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Route options</p>
                      {([
                        { key: "fastest" as const, label: "Fastest", icon: Zap, color: "text-amber-500" },
                        { key: "balanced" as const, label: "Balanced", icon: Route, color: "text-blue-500" },
                        { key: "safest" as const, label: "Safest", icon: Shield, color: "text-emerald-500" },
                      ]).map((opt, i) => {
                        const r = routes[i];
                        const sel = selectedRoute === opt.key;
                        return (
                          <motion.div
                            key={opt.key}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => setSelectedRoute(opt.key)}
                            className={`glass rounded-xl p-3 cursor-pointer transition-all ${sel ? "ring-2 ring-primary/50 bg-white/60" : "hover:bg-white/40"}`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <opt.icon className={`w-4 h-4 ${opt.color}`} />
                                <span className="text-sm font-bold">{opt.label}</span>
                              </div>
                              {sel && <CheckCircle2 className="w-4 h-4 text-primary" />}
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

        {/* ── Map ────────────────────────────────────────────────── */}
        <div className="flex-1 relative z-0">
          {locationLoading && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="glass-card p-6 flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm font-medium text-muted-foreground">Getting your location…</p>
              </div>
            </div>
          )}

          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler
              mode={mapMode}
              onReportClick={handleReportMapClick}
              onOriginClick={handleOriginMapClick}
              onDestClick={handleDestMapClick}
            />
            <FlyTo center={mapCenter} zoom={mapZoom} />

            {/* Incident markers */}
            {filteredIncidents.map((inc) => (
              <Marker
                key={inc._id}
                position={[inc.lat, inc.lng]}
                icon={createIncidentIcon(inc.type)}
              />
            ))}

            {/* Report location pin */}
            {reportLocation && (
              <Marker
                position={reportLocation}
                icon={L.divIcon({
                  className: "report-marker",
                  html: `<div style="width:22px;height:22px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 0 0 5px rgba(59,130,246,0.2),0 4px 12px rgba(59,130,246,0.3)"></div>`,
                  iconSize: [22, 22],
                  iconAnchor: [11, 11],
                })}
              />
            )}

            {/* Origin / Destination pins */}
            {originCoords && (
              <Marker
                position={originCoords}
                icon={L.divIcon({
                  className: "origin-marker",
                  html: `<div style="width:24px;height:24px;border-radius:50%;background:#3b82f6;border:3px solid white;box-shadow:0 4px 12px rgba(59,130,246,0.3);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:white"></div></div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                })}
              />
            )}
            {destCoords && (
              <Marker
                position={destCoords}
                icon={L.divIcon({
                  className: "dest-marker",
                  html: `<div style="width:24px;height:24px;border-radius:50%;background:#8b5cf6;border:3px solid white;box-shadow:0 4px 12px rgba(139,92,246,0.3);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:50%;background:white"></div></div>`,
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                })}
              />
            )}

            {/* Route polyline */}
            {routes.length > 0 && selectedRouteData && (
              <>
                {/* Draw all routes dimmed */}
                {routes.map((r, i) => {
                  const keys = ["fastest", "balanced", "safest"] as const;
                  const isActive = keys[i] === selectedRoute;
                  const color = keys[i] === "safest" ? "#10b981" : keys[i] === "fastest" ? "#f59e0b" : "#3b82f6";
                  return (
                    <Polyline
                      key={keys[i]}
                      positions={r.path}
                      pathOptions={{
                        color,
                        weight: isActive ? 6 : 3,
                        opacity: isActive ? 0.9 : 0.25,
                        dashArray: keys[i] === "safest" && isActive ? "8 6" : undefined,
                      }}
                    />
                  );
                })}
              </>
            )}
          </MapContainer>

          {/* ── Mode indicator banner ────────────────────────────── */}
          <AnimatePresence>
            {modeLabel && (
              <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-[70]"
              >
                <div className="glass-strong rounded-full px-5 py-2 flex items-center gap-2 shadow-lg">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-semibold text-foreground">{modeLabel}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 cursor-pointer"
                    onClick={() => setMapMode("idle")}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Map controls (zoom + recenter) ──────────────────── */}
          <div className="absolute top-4 right-4 z-[50] flex flex-col gap-2">
            <div className="glass-strong rounded-xl overflow-hidden shadow-lg">
              <Button variant="ghost" size="icon" className="w-10 h-10 rounded-none cursor-pointer" onClick={() => setMapZoom((z) => Math.min(z + 1, 18))}>
                <Plus className="w-4 h-4" />
              </Button>
              <div className="w-full h-px bg-white/30" />
              <Button variant="ghost" size="icon" className="w-10 h-10 rounded-none cursor-pointer" onClick={() => setMapZoom((z) => Math.max(z - 1, 3))}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="glass-strong w-10 h-10 cursor-pointer shadow-lg"
              onClick={() => {
                navigator.geolocation?.getCurrentPosition(
                  (pos) => { setMapCenter([pos.coords.latitude, pos.coords.longitude]); setMapZoom(14); },
                  () => { toast.error("Could not get your location"); },
                );
              }}
            >
              <Locate className="w-4 h-4" />
            </Button>
          </div>

          {/* ── Report FAB ──────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="absolute bottom-6 right-6 z-[50]">
            <Button
              onClick={() => {
                const opening = !showReportPanel;
                setShowReportPanel(opening);
                setMapMode(opening ? "reporting" : "idle");
                if (!opening) setReportLocation(null);
              }}
              className={`cursor-pointer rounded-2xl px-5 py-6 shadow-xl font-semibold gap-2 ${
                showReportPanel
                  ? "bg-white text-foreground border border-border hover:bg-white/90"
                  : "bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600 shadow-blue-500/25"
              }`}
            >
              {showReportPanel ? <><X className="w-5 h-5" /> Close</> : <><Plus className="w-5 h-5" /> Report Incident</>}
            </Button>
          </motion.div>
        </div>

        {/* ── Report Incident panel (slides over map) ────────────── */}
        <AnimatePresence>
          {showReportPanel && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-full sm:w-96 glass-strong border-l border-white/30 z-[65] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-white/20 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Report Incident</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {reportLocation ? "Location selected ✓" : "Tap the map to place a marker"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="cursor-pointer" onClick={() => { setShowReportPanel(false); setMapMode("idle"); setReportLocation(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Location */}
                <div className="glass rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">Selected Location</p>
                    {reportLocation ? (
                      <p className="text-xs text-muted-foreground truncate">{reportLocation[0].toFixed(5)}, {reportLocation[1].toFixed(5)}</p>
                    ) : (
                      <p className="text-xs text-amber-600">Tap the map to select</p>
                    )}
                  </div>
                </div>

                {/* Incident type */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5">Incident Type *</label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger className="glass border-white/30 bg-white/40 cursor-pointer"><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([k, l]) => (
                        <SelectItem key={k} value={k}><div className="flex items-center gap-2">{typeIcons[k]}{l}</div></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Severity */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5">Severity *</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(["low", "medium", "high", "critical"] as const).map((s) => (
                      <button key={s} onClick={() => setReportSeverity(s)} className={`glass rounded-lg py-2 px-1 text-xs font-semibold capitalize transition-all cursor-pointer ${reportSeverity === s ? `${severityColors[s]} ring-2 ring-offset-1 ring-current/20` : "bg-white/40 hover:bg-white/60"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs font-semibold block mb-1.5">Description</label>
                  <Textarea placeholder="Additional details (optional)..." value={reportDesc} onChange={(e) => setReportDesc(e.target.value)} className="glass border-white/30 bg-white/40 resize-none h-20" />
                </div>
              </div>

              <div className="p-4 border-t border-white/20">
                <Button
                  onClick={handleReportSubmit}
                  disabled={!reportType || !reportSeverity || !reportLocation || isReporting}
                  className="w-full cursor-pointer bg-gradient-to-r from-blue-500 to-violet-500 text-white border-0 hover:from-blue-600 hover:to-violet-600 py-5"
                >
                  {isReporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
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
