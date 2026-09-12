'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';

const DEFAULT_CENTER = [13.7291, 100.7789];

function donationIcon() {
  return L.divIcon({
    className: 'donationMarkerHost',
    html: '<div class="donationMarker"><span>🎁</span></div>',
    iconSize: [46, 54],
    iconAnchor: [23, 48],
    popupAnchor: [0, -42],
  });
}

const userIcon = L.divIcon({
  className: 'donationMarkerHost',
  html: '<div class="userLocationMarker"><span></span></div>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function FollowUser({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, Math.max(map.getZoom(), 14), { animate: true, duration: 0.45 });
    }
  }, [position, map]);

  return null;
}

function RadiusFollower({ center, radiusKm }) {
  const map = useMap();

  useEffect(() => {
    if (!center || !radiusKm) return;
    const latDelta = radiusKm / 111.32;
    const lngScale = Math.max(0.2, Math.cos((center[0] * Math.PI) / 180));
    const lngDelta = radiusKm / (111.32 * lngScale);
    map.flyToBounds([
      [center[0] - latDelta, center[1] - lngDelta],
      [center[0] + latDelta, center[1] + lngDelta],
    ], {
      animate: true,
      duration: 0.35,
      maxZoom: 16,
      padding: [34, 34],
    });
  }, [map, center, radiusKm]);

  return null;
}

export default function DonationMap({ donations, userPosition, radiusKm }) {
  const center = userPosition || DEFAULT_CENTER;

  return (
    <MapContainer center={center} zoom={14} zoomControl={false} scrollWheelZoom className="donationMapCanvas">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <ZoomControl position="bottomright" />
      <FollowUser position={userPosition} />
      <RadiusFollower center={userPosition} radiusKm={radiusKm} />

      {userPosition && (
        <>
          <Marker position={userPosition} icon={userIcon} interactive={false} zIndexOffset={1000} />
          <Circle
            center={userPosition}
            radius={radiusKm * 1000}
            interactive={false}
            pathOptions={{ color: '#2563eb', weight: 2, opacity: 0.5, fillColor: '#3b82f6', fillOpacity: 0.06 }}
          />
        </>
      )}

      {donations.map((donation) => (
        <Marker key={donation.id} position={[donation.latitude, donation.longitude]} icon={donationIcon()}>
          <Popup closeButton={false} minWidth={230} className="donationPopup">
            <div className="donationPopupCard">
              <span className="donationPopupCategory">{donation.category}</span>
              <strong>{donation.title}</strong>
              <div className="donationPopupMeta">
                <span>จำนวน {donation.quantity}</span>
                <span>{donation.distanceKm.toFixed(1)} กม.</span>
              </div>
              <Link href={`/donations/${donation.id}`} className="donationPopupLink">ดูรายละเอียด →</Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
