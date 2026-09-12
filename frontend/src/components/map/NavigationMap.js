'use client';

import { useEffect } from 'react';
import L from 'leaflet';
import { GeoJSON, MapContainer, Marker, TileLayer, ZoomControl, useMap } from 'react-leaflet';

const userIcon = L.divIcon({
  className: 'donationMarkerHost',
  html: '<div class="userLocationMarker"><span></span></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const destinationIcon = L.divIcon({
  className: 'donationMarkerHost',
  html: '<div class="donationMarker"><span>🎁</span></div>',
  iconSize: [46, 54],
  iconAnchor: [23, 48],
});

function FitRoute({ from, to, geometry }) {
  const map = useMap();

  useEffect(() => {
    if (!from || !to) return;
    const points = [from, to];
    if (geometry?.coordinates) {
      for (const [lng, lat] of geometry.coordinates) points.push([lat, lng]);
    }
    map.fitBounds(points, { padding: [48, 48], maxZoom: 17 });
  }, [map, from, to, geometry]);

  return null;
}

export default function NavigationMap({ from, to, geometry }) {
  return (
    <MapContainer center={from || to} zoom={14} zoomControl={false} scrollWheelZoom className="navigationMapCanvas">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomControl position="bottomright" />
      <FitRoute from={from} to={to} geometry={geometry} />
      {from && <Marker position={from} icon={userIcon} />}
      {to && <Marker position={to} icon={destinationIcon} />}
      {geometry && <GeoJSON data={geometry} style={{ weight: 6, opacity: 0.8 }} />}
    </MapContainer>
  );
}
