import React, { useEffect } from "react";

import {
  MapContainer,
  TileLayer,
  Marker,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default Leaflet marker icons
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Default map location: Hyderabad
const DEFAULT_POSITION = [17.385, 78.4867];

// Convert coordinates safely
function getCoordinates(latitude, longitude) {
  if (
    latitude === null ||
    latitude === undefined ||
    longitude === null ||
    longitude === undefined ||
    latitude === "" ||
    longitude === ""
  ) {
    return null;
  }

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return [lat, lng];
}

// Automatically move the map to show emergency incidents
function MapUpdater({ incidentPositions, userPosition }) {
  const map = useMap();

  useEffect(() => {
    if (incidentPositions.length > 0) {
      const bounds = L.latLngBounds(incidentPositions);

      if (userPosition) {
        bounds.extend(userPosition);
      }

      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 15,
        animate: false,
      });
    } else if (userPosition) {
      map.setView(userPosition, 15, {
        animate: false,
      });
    }
  }, [map, incidentPositions, userPosition]);

  return null;
}

export default function EmergencyMap({
  latitude,
  longitude,
  incidents = [],
}) {
  // User's selected GPS position
  const userPosition = getCoordinates(latitude, longitude);

  // Ensure incidents is always an array
  const safeIncidents = Array.isArray(incidents) ? incidents : [];

  // Keep only incidents with valid coordinates
  const validIncidents = safeIncidents
    .map((incident, index) => {
      const coordinates = getCoordinates(
        incident.latitude,
        incident.longitude
      );

      if (!coordinates) {
        return null;
      }

      return {
        ...incident,
        markerKey: incident.id ?? index,
        coordinates,
      };
    })
    .filter(Boolean);

  // Incident positions used for map bounds
  const incidentPositions = validIncidents.map(
    (incident) => incident.coordinates
  );

  // Create a stable dependency value so the map does not
  // repeatedly reposition on unrelated React renders.
  const positionsKey = JSON.stringify({
    incidents: incidentPositions,
    user: userPosition,
  });

  const mapPositions = React.useMemo(
    () => ({
      incidents: incidentPositions,
      user: userPosition,
    }),
    [positionsKey]
  );

  const initialPosition =
    validIncidents.length > 0
      ? validIncidents[0].coordinates
      : userPosition || DEFAULT_POSITION;

  return (
    <div
      style={{
        width: "100%",
        marginTop: "20px",
      }}
    >
      

      <div
        style={{
          width: "100%",
          height: "400px",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <MapContainer
          center={initialPosition}
          zoom={13}
          scrollWheelZoom={true}
          style={{
            height: "100%",
            width: "100%",
          }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Automatically focus the map */}
          <MapUpdater
            incidentPositions={mapPositions.incidents}
            userPosition={mapPositions.user}
          />

          {/* User GPS marker */}
          {userPosition && (
            <Marker position={userPosition}>
              <Popup>
                📍 Your selected location
              </Popup>
            </Marker>
          )}

          {/* Emergency incident markers */}
          {validIncidents.map((incident) => (
            <CircleMarker
              key={incident.markerKey}
              center={incident.coordinates}
              radius={16}
              pane="markerPane"
              pathOptions={{
                color: "#ffffff",
                weight: 3,
                fillColor: "#e32940",
                fillOpacity: 1,
              }}
            >
              <Popup>
                <div
                  style={{
                    minWidth: "180px",
                  }}
                >
                  <strong
                    style={{
                      color: "#e32940",
                      fontSize: "16px",
                    }}
                  >
                    🚨 {incident.type || "Emergency"}
                  </strong>

                  <p>
                    <strong>Status:</strong>{" "}
                    {incident.status || "Pending"}
                  </p>

                  <p>
                    <strong>Location:</strong>{" "}
                    {incident.location ||
                      incident.coordinates.join(", ")}
                  </p>

                  {incident.description && (
                    <p>
                      <strong>Details:</strong>{" "}
                      {incident.description}
                    </p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}