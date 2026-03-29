import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { getLocations, type Location } from "../api";

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
  popupAnchor: [0, -18],
});

export default function Map() {
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((err) => console.error("Failed to load locations:", err));
  }, []);

  return (
    <MapContainer
      center={[43.7315, -79.7624]}
      zoom={15}
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
      {locations.map((loc) => (
        <Marker key={loc.id} position={[loc.lat, loc.lng]} icon={pinIcon}>
          <Popup>{loc.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
