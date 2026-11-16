'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';

const DEFAULT_CENTER = [13.7291, 100.7789];
const WORLD_BOUNDS = [[-85, -180], [85, 180]];

function donationIcon(selected = false) {
  return L.divIcon({
    className: 'mapMarkerHost',
    html: `<div class="mapAnimalMarker mapAnimalMarker--donation${selected ? ' isSelected' : ''}"><span class="mapAnimalEmoji" aria-hidden="true">🎁</span><b></b></div>`,
    iconSize: [50, 58],
    iconAnchor: [25, 53],
    popupAnchor: [0, -50],
  });
}

const userIcon = L.divIcon({
  className: 'mapMarkerHost',
  html: '<div class="mapUserMarker"><span class="mapUserMarkerPulse"></span><span class="mapUserMarkerDot"></span></div>',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function LocateUser({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) map.setView(position, Math.max(map.getZoom(), 15), { animate: true });
  }, [position, map]);

  if (!position) return null;
  return <Marker position={position} icon={userIcon} zIndexOffset={900} interactive={false} />;
}

function RadiusViewport({ center, radiusKm }) {
  const map = useMap();

  useEffect(() => {
    if (!center || !radiusKm) return;
    const [latitude, longitude] = center;
    const latDelta = radiusKm / 111.32;
    const lngScale = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
    const lngDelta = radiusKm / (111.32 * lngScale);
    const desktop = map.getSize().x > 900;
    map.flyToBounds([
      [latitude - latDelta, longitude - lngDelta],
      [latitude + latDelta, longitude + lngDelta],
    ], {
      animate: true,
      duration: 0.42,
      maxZoom: 16,
      paddingTopLeft: desktop ? [410, 110] : [28, 100],
      paddingBottomRight: desktop ? [48, 105] : [28, 210],
    });
  }, [center, radiusKm, map]);

  return null;
}

function FocusSelectedMarker({ selectedId, donationMarkers }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const marker = donationMarkers.current.get(selectedId);
    if (!marker) return;
    marker.openPopup();
    const position = marker.getLatLng();
    if (map.getSize().x > 900) {
      // Offset desktop map center to keep the popup clear of the result sidebar.
      const projected = map.project(position, map.getZoom()).subtract([120, 0]);
      map.panTo(map.unproject(projected, map.getZoom()), { animate: true });
    } else {
      map.panTo(position, { animate: true });
    }
  }, [selectedId, donationMarkers, map]);
  return null;
}

export default function DonationMap({
  donations,
  userPosition,
  userAccuracy = null,
  radiusKm,
  returnTo = '/',
  selectedId = null,
  onSelectDonation = () => {},
}) {
  const markerRefs = useRef(new Map());

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={14}
      minZoom={3}
      maxBounds={WORLD_BOUNDS}
      maxBoundsViscosity={1}
      className="mapCanvas pawMapCanvas"
      scrollWheelZoom
      zoomControl={false}
    >
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" noWrap />
      <ZoomControl position="bottomright" />
      <LocateUser position={userPosition} />
      <RadiusViewport center={userPosition} radiusKm={radiusKm} />
      <FocusSelectedMarker selectedId={selectedId} donationMarkers={markerRefs} />

      {userPosition && Number.isFinite(userAccuracy) && userAccuracy > 0 && (
        <Circle
          center={userPosition}
          radius={userAccuracy}
          interactive={false}
          className="mapAccuracyCircle"
          pathOptions={{ color: '#38bdf8', weight: 1, opacity: 0.55, fillColor: '#38bdf8', fillOpacity: 0.09, dashArray: '4 5' }}
        />
      )}

      {userPosition && radiusKm && (
        <Circle
          center={userPosition}
          radius={radiusKm * 1000}
          interactive={false}
          className="mapRadiusCircle"
          pathOptions={{ color: '#38bdf8', weight: 2, opacity: 0.72, fillColor: '#38bdf8', fillOpacity: 0.07 }}
        />
      )}

      {donations.map((donation) => {
        const selected = selectedId === donation.id;
        const detailHref = returnTo === '/'
          ? `/donations/${donation.id}`
          : `/donations/${donation.id}?returnTo=${encodeURIComponent(returnTo)}`;

        return (
          <Marker
            key={donation.id}
            ref={(marker) => {
              if (marker) markerRefs.current.set(donation.id, marker);
              else markerRefs.current.delete(donation.id);
            }}
            position={[donation.latitude, donation.longitude]}
            icon={donationIcon(selected)}
            zIndexOffset={selected ? 500 : 0}
            eventHandlers={{ click: () => onSelectDonation(donation.id) }}
          >
            <Popup className="pawPopup" closeButton={false} minWidth={238}>
              <div className="popupCard">
                <div className="popupTypeRow"><span className="popupAnimalIcon popupAnimalIcon--donation" aria-hidden="true">🎁</span><span>{donation.category}</span></div>
                <strong className="popupHeadline">{donation.title}</strong>
                <div className="popupData"><span>จำนวน / ระยะทาง</span><strong>{donation.quantity} ชิ้น · {Number(donation.distanceKm).toFixed(1)} กม.</strong></div>
                <Link className="popupAction" href={detailHref}>ดูรายละเอียด <span aria-hidden="true">→</span></Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
