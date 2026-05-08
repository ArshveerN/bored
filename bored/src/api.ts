import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface ScheduleSlot {
  day: string;
  start: string;
  end: string;
}

export interface Run {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  lat: number;
  lng: number;
  schedule: ScheduleSlot[] | null;
  photos: string[];
  created_at: string;
}

export async function getRuns(): Promise<Run[]> {
  const { data, error } = await supabase.from("runs").select("*");
  if (error) throw error;
  return data ?? [];
}

export type TravelMode = "driving" | "walking" | "cycling";

export interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][];
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
}

export async function geocode(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    query
  )}&format=json&limit=1`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const data: Array<{ lat: string; lon: string; display_name: string }> =
    await res.json();
  if (data.length === 0) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    label: data[0].display_name,
  };
}

export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  options: { mode?: TravelMode; signal?: AbortSignal } = {}
): Promise<RouteInfo> {
  const mode = options.mode ?? "driving";
  const url = `https://router.project-osrm.org/route/v1/${mode}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url, { signal: options.signal });
  if (!res.ok) throw new Error(`Route fetch failed: ${res.status}`);
  const data = await res.json();
  if (!data.routes?.length) throw new Error("No route found");
  const route = data.routes[0];
  const geometry: [number, number][] = route.geometry.coordinates.map(
    ([lng, lat]: [number, number]) => [lat, lng]
  );
  return {
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry,
  };
}
