'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import CategoryFilter from '../components/map/CategoryFilter';
import RadiusFilter from '../components/map/RadiusFilter';
import { api } from '../lib/api';

const DonationMap = dynamic(() => import('../components/map/DonationMap'), { ssr: false });
const DEFAULT_RADIUS_KM = 5;
const SEARCH_DEBOUNCE_MS = 300;

export default function HomePage() {
  const [userPosition, setUserPosition] = useState(null);
  const [donations, setDonations] = useState([]);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const [category, setCategory] = useState('');
  const [locating, setLocating] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      setError('Browser นี้ไม่รองรับการอ่านตำแหน่ง');
      return;
    }

    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserPosition([coords.latitude, coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError('ไม่สามารถอ่านตำแหน่งได้ กรุณาอนุญาต Location แล้วลองอีกครั้ง');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(locate, 0);
    return () => clearTimeout(timer);
  }, [locate]);

  useEffect(() => {
    if (!userPosition) return undefined;
    const timer = setTimeout(async () => {
      const query = new URLSearchParams({
        lat: String(userPosition[0]),
        lng: String(userPosition[1]),
        radius: String(radiusKm),
      });
      if (category.trim()) query.set('category', category.trim());

      setLoading(true);
      setError('');
      try {
        setDonations(await api(`/api/donations/nearby?${query}`));
      } catch (requestError) {
        setError(requestError.message || 'โหลดจุดบริจาคไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [userPosition, radiusKm, category]);

  return (
    <main className="mapShell">
      <DonationMap donations={donations} userPosition={userPosition} radiusKm={radiusKm} />

      <div className="mapSummary" aria-live="polite">
        <span className="mapSummaryDot" aria-hidden="true" />
        <strong>{donations.length}</strong>
        <span>{userPosition ? 'จุดในรัศมี' : 'จุดบริจาค'}</span>
      </div>

      {(loading || error) && (
        <div className={`mapStatus${error ? ' mapStatusError' : ''}`} role="status">
          {error || 'กำลังอัปเดตจุดบริจาค...'}
        </div>
      )}

      <button className="mapFloatButton mapLocateButton" type="button" onClick={locate} aria-label="ตำแหน่งฉัน" disabled={locating}>
        {locating ? <span className="mapLocateSpinner" aria-hidden="true" /> : <span className="mapLocateGlyph" aria-hidden="true" />}
      </button>

      <CategoryFilter value={category} onChange={setCategory} disabled={!userPosition} />
      <RadiusFilter value={radiusKm} onChange={setRadiusKm} disabled={!userPosition} locating={locating} />
    </main>
  );
}
