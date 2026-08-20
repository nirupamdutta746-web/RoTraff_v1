/**
 * TomTom API Helpers
 *
 * All TomTom API usage is confined to this file.
 * Requires VITE_TOMTOM_API_KEY in .env.local
 */

const API_KEY = import.meta.env.VITE_TOMTOM_API_KEY || "";
const DIRECT = "https://api.tomtom.com";
// Search API blocks browser CORS, so proxy through Vite dev server
const PROXY = import.meta.env.DEV ? "/tomtom" : "https://api.tomtom.com";

function getKey() {
  if (!API_KEY) throw new Error("Missing VITE_TOMTOM_API_KEY env var");
  return API_KEY;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface TomTomRoute {
  path: [number, number][];
  travelTime: string;
  distance: string;
  trafficDelay: string;
  departureTime: string;
  arrivalTime: string;
}

export interface TomTomSearchResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: string;
}

// ── Traffic Flow ──────────────────────────────────────────────────────────

/**
 * Get traffic flow data for a bounding box.
 * Returns flow segments with current speed, free flow speed, and congestion level.
 */
export async function getTrafficFlow(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
): Promise<any> {
  const key = getKey();
  const url = `${PROXY}/traffic/services/4/flowSegmentData/absolute/10/json?key=${key}&bbox=${minLng},${minLat},${maxLng},${maxLat}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Traffic flow request failed: ${resp.status}`);
  return resp.json();
}

/**
 * Get traffic incident data for a bounding box.
 */
export async function getTrafficIncidents(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
): Promise<any> {
  const key = getKey();
  const url = `${PROXY}/traffic/services/5/incidentDetails?key=${key}&bbox=${minLng},${minLat},${maxLng},${maxLat}&fields={incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,delay{value}}}}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Traffic incidents request failed: ${resp.status}`);
  return resp.json();
}

// ── Routing ───────────────────────────────────────────────────────────────

/**
 * Calculate a real route using TomTom Directions API.
 * @param origin [lat, lng]
 * @param destination [lat, lng]
 * @param routeType "fastest" | "shortest" | "eco" | "thrilling"
 * @param traffic boolean - whether to use traffic data
 */
export async function calculateRoute(
  origin: [number, number],
  destination: [number, number],
  routeType: "fastest" | "shortest" | "eco" | "thrilling" = "fastest",
  traffic: boolean = true,
): Promise<TomTomRoute> {
  const key = getKey();
  const oLng = origin[1];
  const oLat = origin[0];
  const dLng = destination[1];
  const dLat = destination[0];

  const url = `${DIRECT}/routing/1/calculateRoute/${oLat},${oLng}:${dLat},${dLng}/json?key=${key}&routeType=${routeType}&traffic=${traffic ? "live" : "false"}&travelMode=car&language=en-US`;

  const resp = await fetch(url, { mode: "cors" });
  const data = await resp.json();
  if (!resp.ok) {
    const msg = data?.error?.message || data?.detailedError?.message || `HTTP ${resp.status}`;
    throw new Error(`Route failed: ${msg}`);
  }

  if (!data.routes || data.routes.length === 0) {
    throw new Error("No route found between these points");
  }

  const route = data.routes[0];
  const legs = route.legs[0];

  // Decode the path from the route summary
  const summary = legs.summary;
  const points = route.legs[0].points || [];

  // TomTom returns points as {latitude, longitude} objects
  const path: [number, number][] = points.map((p: any) => [
    p.latitude ?? p[1] ?? p.lat,
    p.longitude ?? p[0] ?? p.lon,
  ]);

  // If no detailed points, use origin and destination
  if (path.length === 0) {
    path.push(origin, destination);
  }

  const travelTimeSec = summary.travelTimeInSeconds || 0;
  const distMeters = summary.lengthInMeters || 0;
  const delaySec = summary.trafficDelayInSeconds || 0;

  return {
    path,
    travelTime: formatDuration(travelTimeSec),
    distance: formatDistance(distMeters),
    trafficDelay: formatDuration(delaySec),
    departureTime: summary.departureTime || "",
    arrivalTime: summary.arrivalTime || "",
  };
}

/**
 * Calculate multiple route alternatives.
 */
export async function calculateRoutes(
  origin: [number, number],
  destination: [number, number],
): Promise<{ fastest: TomTomRoute; shortest: TomTomRoute; eco: TomTomRoute }> {
  const [fastest, shortest, eco] = await Promise.all([
    calculateRoute(origin, destination, "fastest", true),
    calculateRoute(origin, destination, "shortest", false),
    calculateRoute(origin, destination, "eco", true),
  ]);
  return { fastest, shortest, eco };
}

// ── Geocoding / Search ────────────────────────────────────────────────────

/**
 * Search for places by text query.
 * Returns top results with name, address, and coordinates.
 */
export async function searchPlaces(
  query: string,
  biasLat?: number,
  biasLng?: number,
  limit: number = 5,
): Promise<TomTomSearchResult[]> {
  const key = getKey();
  let url = `${PROXY}/search/2/search/${encodeURIComponent(query)}.json?key=${key}&limit=${limit}&typeahead=true`;

  if (biasLat !== undefined && biasLng !== undefined) {
    url += `&lat=${biasLat}&lon=${biasLng}`;
  }

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
  const data = await resp.json();

  if (!data.results) return [];

  return data.results.map((r: any) => ({
    id: r.id,
    name: r.address?.freeformAddress || r.poi?.name || "Unknown",
    address: r.address?.freeformAddress || "",
    lat: r.position?.lat || 0,
    lng: r.position?.lon || 0,
    type: r.entityType || "Point",
  }));
}

/**
 * Reverse geocode: get address from coordinates.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string> {
  const key = getKey();
  const url = `${PROXY}/search/2/reverseGeocode/${lat},${lng}.json?key=${key}&language=en-US`;
  const resp = await fetch(url);
  if (!resp.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const data = await resp.json();
  return data.addresses?.[0]?.address?.freeformAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
