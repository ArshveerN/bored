import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  getRuns,
  getRoute,
  geocode,
  type Run,
  type RouteInfo,
} from "../api";

const ROUTE_TIMEOUT_MS = 8000;
const GEOCODE_TIMEOUT_MS = 6000;

const pinIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 16px;
      height: 16px;
      background: #ff4444;
      border: 2px solid #fff;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    "></div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 16],
});

const userIcon = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 16px;
      height: 16px;
      background: #4285f4;
      border: 3px solid #fff;
      border-radius: 50%;
      box-shadow: 0 0 0 6px rgba(66,133,244,0.25), 0 2px 6px rgba(0,0,0,0.5);
      cursor: grab;
    "></div>
  `,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

type RouteStatus =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; route: RouteInfo }
  | { kind: "error"; message: string };

function formatDistance(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(s: number) {
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

function CenterOnUser({
  position,
  enabled,
}: {
  position: [number, number] | null;
  enabled: boolean;
}) {
  const map = useMap();
  const centered = useRef(false);
  useEffect(() => {
    if (enabled && position && !centered.current) {
      map.setView(position, 14);
      centered.current = true;
    }
  }, [position, enabled, map]);
  return null;
}

function FitToRoute({ route }: { route: RouteInfo | null }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.geometry.length > 0) {
      map.fitBounds(L.latLngBounds(route.geometry), { padding: [60, 60] });
    }
  }, [route, map]);
  return null;
}

function MapClickHandler({ onClick }: { onClick: () => void }) {
  useMapEvents({ click: onClick });
  return null;
}

function LocationControl({
  manual,
  onSubmitAddress,
  onReset,
}: {
  manual: boolean;
  onSubmitAddress: (lat: number, lng: number, label: string) => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      GEOCODE_TIMEOUT_MS
    );

    try {
      const result = await geocode(q, controller.signal);
      if (!result) {
        setError("Address not found");
      } else {
        onSubmitAddress(result.lat, result.lng, result.label);
        setQuery("");
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setError("Lookup took too long");
      } else {
        setError("Geocoding failed");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        width: 280,
        background: "rgba(20,20,22,0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 10,
        zIndex: 1000,
        boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
        color: "#f5f5f5",
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 6 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Set location by address…"
          disabled={loading}
          style={{
            flex: 1,
            padding: "6px 10px",
            background: "rgba(255,255,255,0.06)",
            color: "#f5f5f5",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 6,
            fontSize: 13,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            padding: "6px 12px",
            background: "#4285f4",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            cursor: loading || !query.trim() ? "default" : "pointer",
            opacity: loading || !query.trim() ? 0.5 : 1,
          }}
        >
          {loading ? "…" : "Go"}
        </button>
      </form>

      {error && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#ff8a8a" }}>
          {error}
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          color: "#888",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>
          {manual ? "Using manual location" : "Drag the blue dot to fine-tune"}
        </span>
        {manual && (
          <button
            onClick={onReset}
            style={{
              background: "none",
              border: "none",
              color: "#4285f4",
              cursor: "pointer",
              padding: 0,
              fontSize: 11,
              textDecoration: "underline",
            }}
          >
            Reset to GPS
          </button>
        )}
      </div>
    </div>
  );
}

function RunCard({
  run,
  status,
  onRetry,
  onClose,
}: {
  run: Run;
  status: RouteStatus;
  onRetry: () => void;
  onClose: () => void;
}) {
  const photos = run.photos ?? [];
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        bottom: 24,
        left: 24,
        width: 320,
        maxHeight: "75vh",
        background: "rgba(20, 20, 22, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        color: "#f5f5f5",
        zIndex: 1000,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {photos.length > 0 && (
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            height: 180,
            flexShrink: 0,
          }}
        >
          {photos.map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${run.name} ${i + 1}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                flexShrink: 0,
                scrollSnapAlign: "start",
              }}
            />
          ))}
        </div>
      )}

      <div style={{ padding: 16, overflowY: "auto", position: "relative" }}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "#f5f5f5",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>

        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 28px 4px 0" }}>
          {run.name}
        </h2>
        {run.address && (
          <p style={{ fontSize: 12, color: "#999", margin: 0 }}>
            {run.address}
          </p>
        )}

        <div style={{ marginTop: 14, minHeight: 22 }}>
          {status.kind === "loading" && (
            <span style={{ fontSize: 13, color: "#888" }}>
              Calculating route…
            </span>
          )}
          {status.kind === "ok" && (
            <span style={{ fontSize: 14, fontWeight: 500, color: "#4285f4" }}>
              {formatDistance(status.route.distanceMeters)} ·{" "}
              {formatDuration(status.route.durationSeconds)}
            </span>
          )}
          {status.kind === "error" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
                color: "#ff8a8a",
              }}
            >
              <span>{status.message}</span>
              <button
                onClick={onRetry}
                style={{
                  padding: "4px 10px",
                  background: "rgba(255,255,255,0.08)",
                  color: "#f5f5f5",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {run.description && (
          <>
            <div
              style={{
                marginTop: 16,
                fontSize: 11,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Description
            </div>
            <p
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "#ddd",
                lineHeight: 1.5,
              }}
            >
              {run.description}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function GeoBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        background: "rgba(20,20,22,0.92)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "#f5f5f5",
        padding: "8px 14px",
        borderRadius: 8,
        fontSize: 13,
        zIndex: 1000,
        boxShadow: "0 4px 14px rgba(0,0,0,0.5)",
        border: "1px solid rgba(255,255,255,0.08)",
        maxWidth: "calc(100vw - 32px)",
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);

  const [runs, setRuns] = useState<Run[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [manualLocation, setManualLocation] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [routeStatus, setRouteStatus] = useState<RouteStatus>({ kind: "idle" });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    getRuns()
      .then(setRuns)
      .catch((err) => console.error("Failed to load runs:", err));
  }, []);

  useEffect(() => {
    if (manualLocation) return;
    if (!navigator.geolocation) {
      setGeoError("Location not supported by this browser");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setAccuracy(pos.coords.accuracy);
        setGeoError(null);
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location access denied — distances unavailable"
            : "Couldn't get your location — distances unavailable"
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [manualLocation]);

  useEffect(() => {
    if (!selectedRun) {
      setRouteStatus({ kind: "idle" });
      return;
    }
    if (!userPos) {
      setRouteStatus({
        kind: "error",
        message: geoError ?? "Waiting for your location…",
      });
      return;
    }

    let cancelled = false;
    let timedOut = false;
    setRouteStatus({ kind: "loading" });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ROUTE_TIMEOUT_MS);

    getRoute(
      { lat: userPos[0], lng: userPos[1] },
      { lat: selectedRun.lat, lng: selectedRun.lng },
      { signal: controller.signal }
    )
      .then((route) => {
        if (cancelled) return;
        setRouteStatus({ kind: "ok", route });
      })
      .catch((err) => {
        if (cancelled) return;
        if (timedOut) {
          setRouteStatus({
            kind: "error",
            message: "Route is taking too long",
          });
        } else if (err?.name !== "AbortError") {
          setRouteStatus({
            kind: "error",
            message: "Couldn't calculate route",
          });
        }
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [selectedRun, userPos, geoError, retryKey]);

  function handleAddressSet(lat: number, lng: number, _label: string) {
    setUserPos([lat, lng]);
    setAccuracy(null);
    setGeoError(null);
    setManualLocation(true);
    mapRef.current?.setView([lat, lng], 14);
  }

  function handleDragEnd(e: L.LeafletEvent) {
    const marker = e.target as L.Marker;
    const { lat, lng } = marker.getLatLng();
    setUserPos([lat, lng]);
    setAccuracy(null);
    setGeoError(null);
    setManualLocation(true);
  }

  function handleResetGPS() {
    setManualLocation(false);
    setUserPos(null);
    setAccuracy(null);
  }

  const route = routeStatus.kind === "ok" ? routeStatus.route : null;

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapContainer
        ref={mapRef}
        center={[43.7315, -79.7624]}
        zoom={15}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          className="map-labels"
        />
        <CenterOnUser position={userPos} enabled={!manualLocation} />
        <FitToRoute route={route} />
        <MapClickHandler onClick={() => setSelectedRun(null)} />
        {userPos && accuracy !== null && accuracy > 30 && (
          <Circle
            center={userPos}
            radius={accuracy}
            pathOptions={{
              color: "#4285f4",
              fillColor: "#4285f4",
              fillOpacity: 0.08,
              weight: 1,
              opacity: 0.35,
            }}
          />
        )}
        {userPos && (
          <Marker
            position={userPos}
            icon={userIcon}
            draggable
            eventHandlers={{ dragend: handleDragEnd }}
          />
        )}
        {runs.map((run) => (
          <Marker
            key={run.id}
            position={[run.lat, run.lng]}
            icon={pinIcon}
            eventHandlers={{ click: () => setSelectedRun(run) }}
          />
        ))}
        {route && (
          <Polyline
            positions={route.geometry}
            pathOptions={{ color: "#4285f4", weight: 4, opacity: 0.85 }}
          />
        )}
      </MapContainer>
      <LocationControl
        manual={manualLocation}
        onSubmitAddress={handleAddressSet}
        onReset={handleResetGPS}
      />
      {geoError && !selectedRun && <GeoBanner message={geoError} />}
      {selectedRun && (
        <RunCard
          run={selectedRun}
          status={routeStatus}
          onRetry={() => setRetryKey((k) => k + 1)}
          onClose={() => setSelectedRun(null)}
        />
      )}
    </div>
  );
}
